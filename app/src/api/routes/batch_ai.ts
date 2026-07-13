import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { OpenAI } from 'openai';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import ms from 'ms';
import { waitUntil } from '@vercel/functions';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db, type transactionType } from '~/db/db';
import {
  ai_batches,
  ai_batch_responses,
  image_assets,
  project_paths,
  projects,
  texts
} from '~/db/schema';
import { createAiBatch, getAiBatchResult, type AiBatchInput } from '~/utils/ai_batch';
import type { AiBatchPollingStatus } from '~/utils/ai_batch/types';
import { getShlokaImageBatchCustomId } from '~/utils/ai_batch/shloka-image';
import { deriveImageBatchUiStatus } from '~/utils/ai_batch/batch_image_status';
import {
  BATCH_POLLING_INTERVAL_S,
  image_batch_metadata_schema,
  type BatchMetadata
} from '~/utils/types/ai_batch_metadata';
import { publishAiBatchResultsQueue } from '~/utils/qstash';
import { createS3Client } from '~/utils/s3/upload_file.server';
import {
  deleteImageAssetById,
  linkImageAssetToText,
  persistImageAsset
} from '~/utils/image_assets/persist.server';
import { get_project_info_by_id } from '~/utils/project/list.server';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/utils/project/paths_db.server';
import { available_image_models_schema } from '~/api/routes/ai/ai_types';
import { get_image_prompt_func } from '~/api/routes/ai/get_image_prompt';
import { getCDNUrl } from '~/utils/cdn';
import { text_models_enum } from '~/api/routes/ai/ai_types';
import { env } from '$env/dynamic/private';

/** Lazy: avoid SDK constructors during SvelteKit postbuild analyse (private env empty). */
let openai: OpenAI | undefined;
const getOpenAI = () => (openai ??= new OpenAI({ apiKey: env.OPENAI_API_KEY }));

let s3Client: ReturnType<typeof createS3Client> | undefined;
const getS3Client = () => (s3Client ??= createS3Client());

const POLL_CLAIM_STALE_MS = ms('12mins');

const trigger_item_schema = z.object({
  index: z.int().min(0),
  /** Pre-generated / edited prompt; when omitted the server generates one */
  image_prompt: z.string().min(1).optional()
});

const trigger_batch_input_schema = z.object({
  auto_approved: z.boolean().default(true),
  project_id: z.int(),
  selected_text_levels: z.array(z.int().nullable()),
  image_model: available_image_models_schema.default('gpt-image-2'),
  text_model: text_models_enum.default('gpt-5.2'),
  project_key: z.string(),
  items: z.array(trigger_item_schema).min(1)
});

/** Delete OpenAI Files API objects (batch input/output). Ignores already-deleted files. */
async function deleteOpenAiFiles(file_ids: (string | null | undefined)[]) {
  const unique_ids = [...new Set(file_ids.filter((id): id is string => !!id))];
  await Promise.all(
    unique_ids.map(async (file_id) => {
      try {
        await getOpenAI().files.delete(file_id);
      } catch (err) {
        // OpenAI often expires/removes batch files before we clean up — 404 is expected.
        const status = (err as { status?: number } | null)?.status;
        if (status === 404) return;
        console.error(`Failed to delete OpenAI file ${file_id}:`, err);
      }
    })
  );
}

function scheduleOpenAiBatchCleanup(batch_id: string) {
  const cleanup = (async () => {
    const remaining = await db.query.ai_batch_responses.findFirst({
      columns: { batch_id: true },
      where: eq(ai_batch_responses.batch_id, batch_id)
    });
    if (remaining) return;

    const batch = await db.query.ai_batches.findFirst({
      columns: { input_file_id: true, output_file_id: true },
      where: eq(ai_batches.batch_id, batch_id)
    });
    if (!batch) return;

    await db.delete(ai_batches).where(eq(ai_batches.batch_id, batch_id));
    await deleteOpenAiFiles([batch.input_file_id, batch.output_file_id]);
  })().catch((err) => {
    console.error(`Failed OpenAI batch file cleanup for batch ${batch_id}:`, err);
  });

  waitUntil(cleanup);
}

const responseItemUnprocessed = sql`${ai_batch_responses.metadata}->>'success' IS NULL`;

async function tryClaimBatchRow(batch_id: string, custom_id: string) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(ai_batch_responses)
      .where(
        and(
          eq(ai_batch_responses.batch_id, batch_id),
          eq(ai_batch_responses.custom_id, custom_id),
          responseItemUnprocessed
        )
      )
      .for('update')
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const metadata = image_batch_metadata_schema.parse(row.metadata);
    if (metadata.poll_claimed_at) {
      const claimed_at = Date.parse(metadata.poll_claimed_at);
      if (!Number.isNaN(claimed_at) && Date.now() - claimed_at < POLL_CLAIM_STALE_MS) {
        return null;
      }
    }

    const claimed_metadata = { ...metadata, poll_claimed_at: new Date().toISOString() };
    const updated = await tx
      .update(ai_batch_responses)
      .set({ metadata: claimed_metadata })
      .where(
        and(
          eq(ai_batch_responses.batch_id, batch_id),
          eq(ai_batch_responses.custom_id, custom_id),
          responseItemUnprocessed
        )
      )
      .returning();

    if (updated.length === 0) return null;
    return { ...row, metadata: claimed_metadata };
  });
}

async function updateBatchResponse(
  tx: transactionType,
  batch_id: string,
  custom_id: string,
  metadata: BatchMetadata,
  output_file_id?: string | null
): Promise<boolean> {
  const updated = await tx
    .update(ai_batch_responses)
    .set({ metadata })
    .where(
      and(
        eq(ai_batch_responses.batch_id, batch_id),
        eq(ai_batch_responses.custom_id, custom_id),
        responseItemUnprocessed
      )
    )
    .returning();

  if (updated.length === 0) return false;

  if (output_file_id != null) {
    await tx.update(ai_batches).set({ output_file_id }).where(eq(ai_batches.batch_id, batch_id));
  }
  return true;
}

function isResponseItemProcessed(metadata: BatchMetadata): boolean {
  return metadata.success !== undefined;
}

async function markBatchOutputResolvedIfComplete(
  tx: transactionType,
  batch_id: string,
  output_file_id?: string | null
) {
  const responses = await tx.query.ai_batch_responses.findMany({
    where: eq(ai_batch_responses.batch_id, batch_id),
    columns: { metadata: true }
  });
  const all_processed = responses.every((row) =>
    isResponseItemProcessed(image_batch_metadata_schema.parse(row.metadata))
  );
  if (!all_processed) return;

  await tx
    .update(ai_batches)
    .set({
      output_resolved: true,
      ...(output_file_id != null ? { output_file_id } : {})
    })
    .where(and(eq(ai_batches.batch_id, batch_id), eq(ai_batches.output_resolved, false)));
}

type PollItem = {
  custom_id: string;
  success: boolean;
  uploaded_image_id?: number;
  message?: string;
};

type PollCoreResult =
  | { status: 'pending'; batch_id: string; openai_status: AiBatchPollingStatus }
  | { status: 'terminal_failure'; batch_id: string; openai_status: AiBatchPollingStatus }
  | { status: 'already_resolved'; batch_id: string; items: PollItem[] }
  | { status: 'processed'; batch_id: string; items: PollItem[] };

export type PollBatchShlokaImageGenResult = PollCoreResult & { message: string };

function toPollItem(custom_id: string, metadata: BatchMetadata): PollItem {
  return {
    custom_id,
    success: metadata.success === true,
    uploaded_image_id: metadata.uploaded_image_id
  };
}

function buildProcessedMessage(items: PollItem[]) {
  const succeeded = items.filter((item) => item.success).length;
  const auto_connected = items.filter((item) => item.message?.startsWith('Auto-linked')).length;
  const failed = items.length - succeeded;
  const parts = [`${succeeded}/${items.length} batch item(s) succeeded`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (auto_connected > 0) parts.push(`${auto_connected} auto-linked`);
  return parts.join('; ') + '.';
}

const TERMINAL_FAILURE_STATUSES: ReadonlySet<AiBatchPollingStatus> = new Set([
  'failed',
  'expired',
  'cancelled'
]);

/** Connect staged image into text_image_assets_join and remove the batch response row. */
export const approve_connect_shloka_image_func = async (batch_id: string, custom_id: string) => {
  const result = await db.transaction(async (tx) => {
    const ai_batch_data = await tx.query.ai_batch_responses.findFirst({
      where: and(
        eq(ai_batch_responses.batch_id, batch_id),
        eq(ai_batch_responses.custom_id, custom_id)
      )
    });
    if (!ai_batch_data) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No metadata found for batch_id ${batch_id} and custom_id ${custom_id}`
      });
    }
    const metadata = image_batch_metadata_schema.parse(ai_batch_data.metadata);
    if (metadata.success !== true || metadata.uploaded_image_id === undefined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Image not ready for batch_id ${batch_id} and custom_id ${custom_id}`
      });
    }

    await linkImageAssetToText(tx, {
      project_path_id: metadata.project_path_id,
      index: metadata.index,
      image_asset_id: metadata.uploaded_image_id
    });

    await tx
      .delete(ai_batch_responses)
      .where(
        and(eq(ai_batch_responses.batch_id, batch_id), eq(ai_batch_responses.custom_id, custom_id))
      );

    return {
      success: true as const,
      project_path_id: metadata.project_path_id,
      index: metadata.index,
      uploaded_image_id: metadata.uploaded_image_id
    };
  });

  scheduleOpenAiBatchCleanup(batch_id);
  return result;
};

async function autoApproveEligibleRows(batch_id: string, items: PollItem[]): Promise<PollItem[]> {
  const rows = await db.query.ai_batch_responses.findMany({
    where: eq(ai_batch_responses.batch_id, batch_id),
    columns: { custom_id: true, auto_approved: true }
  });
  const auto_approved_custom_ids = new Set(
    rows.filter((row) => row.auto_approved).map((row) => row.custom_id)
  );

  return Promise.all(
    items.map(async (item) => {
      if (!item.success || !auto_approved_custom_ids.has(item.custom_id)) return item;
      try {
        const result = await approve_connect_shloka_image_func(batch_id, item.custom_id);
        return {
          ...item,
          message: `Auto-linked image ${result.uploaded_image_id} to path ${result.project_path_id} index ${result.index}`
        };
      } catch (err) {
        const message =
          err instanceof TRPCError ? err.message : 'Auto-approve failed to link image';
        return { ...item, message };
      }
    })
  );
}

export const poll_batch_shloka_image_gen_func = async (
  batch_id: string
): Promise<PollBatchShlokaImageGenResult> => {
  const ai_batch = await db.query.ai_batches.findFirst({
    where: eq(ai_batches.batch_id, batch_id),
    with: { responses: true }
  });
  // Missing/empty after approve+cleanup is a terminal success, not NOT_FOUND.
  if (!ai_batch || ai_batch.responses.length === 0) {
    return {
      status: 'already_resolved' as const,
      batch_id,
      items: [],
      message: `Batch ${batch_id} already resolved or cleaned up`
    };
  }

  const db_rows = ai_batch.responses;

  if (ai_batch.output_resolved) {
    const items = await autoApproveEligibleRows(
      batch_id,
      db_rows.map((row) =>
        toPollItem(row.custom_id, image_batch_metadata_schema.parse(row.metadata))
      )
    );
    return {
      status: 'already_resolved',
      batch_id,
      items,
      message: buildProcessedMessage(items)
    };
  }

  const batch = await getAiBatchResult(getOpenAI(), batch_id, {
    outputs: db_rows.map((row) => ({ type: 'image' as const, custom_id: row.custom_id }))
  });
  const batch_output_file_id = batch.output_file_id ?? null;

  if (batch.status !== 'completed') {
    const openai_status = batch.status;
    if (TERMINAL_FAILURE_STATUSES.has(openai_status)) {
      await db.transaction(async (tx) => {
        await Promise.all(
          db_rows
            .filter(
              (row) => !isResponseItemProcessed(image_batch_metadata_schema.parse(row.metadata))
            )
            .map((row) =>
              updateBatchResponse(
                tx,
                batch_id,
                row.custom_id,
                {
                  ...image_batch_metadata_schema.parse(row.metadata),
                  success: false
                },
                batch_output_file_id
              )
            )
        );
        await markBatchOutputResolvedIfComplete(tx, batch_id, batch_output_file_id);
      });
      return {
        status: 'terminal_failure',
        batch_id,
        openai_status,
        message: `Batch ended with status ${openai_status}; outputs marked as failed.`
      };
    }

    return {
      status: 'pending',
      batch_id,
      openai_status,
      message: `Batch is still ${openai_status}; try again later.`
    };
  }

  const output_by_custom_id = new Map(
    [...batch.responses, ...batch.errors].map((output) => [output.custom_id, output])
  );

  // Parallelize claim → S3 upload → DB update per row (mark resolved once after).
  const items = (
    await Promise.all(
      db_rows.map(async (row): Promise<PollItem | null> => {
        const row_metadata = image_batch_metadata_schema.parse(row.metadata);
        if (isResponseItemProcessed(row_metadata)) {
          return toPollItem(row.custom_id, row_metadata);
        }

        const claimed_row = await tryClaimBatchRow(batch_id, row.custom_id);
        if (!claimed_row) {
          const resolved_row = await db.query.ai_batch_responses.findFirst({
            where: and(
              eq(ai_batch_responses.batch_id, batch_id),
              eq(ai_batch_responses.custom_id, row.custom_id)
            )
          });
          if (resolved_row) {
            const resolved_metadata = image_batch_metadata_schema.parse(resolved_row.metadata);
            if (isResponseItemProcessed(resolved_metadata)) {
              return toPollItem(resolved_row.custom_id, resolved_metadata);
            }
          }
          return null;
        }

        const metadata = image_batch_metadata_schema.parse(claimed_row.metadata);
        const output = output_by_custom_id.get(row.custom_id);

        if (!output || !output.success || output.type !== 'image' || !output.image_b64) {
          const wrote = await db.transaction(async (tx) =>
            updateBatchResponse(tx, batch_id, row.custom_id, {
              ...metadata,
              success: false
            })
          );
          return wrote ? { custom_id: row.custom_id, success: false } : null;
        }

        let upload_result: Awaited<ReturnType<typeof persistImageAsset>>;
        try {
          upload_result = await persistImageAsset({
            project_id: metadata.project_id,
            project_path_id: metadata.project_path_id,
            path_params: metadata.path_params,
            index: metadata.index,
            image: output.image_b64,
            description: metadata.image_prompt.slice(0, 150),
            s3Client: getS3Client(),
            // Staging only — join is created on approve / auto-approve
            create_join: false
          });
        } catch (err) {
          console.error(`Batch image upload failed for ${row.custom_id}:`, err);
          const wrote = await db.transaction(async (tx) =>
            updateBatchResponse(tx, batch_id, row.custom_id, {
              ...metadata,
              success: false
            })
          );
          return wrote ? { custom_id: row.custom_id, success: false } : null;
        }

        const persisted = await db.transaction(async (tx) =>
          updateBatchResponse(
            tx,
            batch_id,
            row.custom_id,
            {
              ...metadata,
              success: true,
              uploaded_image_id: upload_result.id
            },
            batch_output_file_id
          )
        );

        if (!persisted) {
          await deleteImageAssetById(upload_result.id, { s3Client: getS3Client() }).catch((err) => {
            console.error(
              `Failed to clean up duplicate batch upload image ${upload_result.id}:`,
              err
            );
          });
          return null;
        }

        return {
          custom_id: row.custom_id,
          success: true,
          uploaded_image_id: upload_result.id
        };
      })
    )
  ).filter((item): item is PollItem => item !== null);

  await db.transaction(async (tx) => {
    await markBatchOutputResolvedIfComplete(tx, batch_id, batch_output_file_id);
  });

  const resolved_items = await autoApproveEligibleRows(batch_id, items);
  return {
    status: 'processed',
    batch_id,
    items: resolved_items,
    message: buildProcessedMessage(resolved_items)
  };
};

async function assertNoUnresolvedDuplicates(project_path_id: number, indexes: number[]) {
  const rows = await db
    .select({
      metadata: ai_batch_responses.metadata,
      batch_id: ai_batch_responses.batch_id
    })
    .from(ai_batch_responses)
    .innerJoin(ai_batches, eq(ai_batch_responses.batch_id, ai_batches.batch_id))
    .where(
      and(
        eq(ai_batches.type, 'image'),
        eq(ai_batches.output_resolved, false),
        sql`(${ai_batch_responses.metadata}->>'project_path_id')::int = ${project_path_id}`
      )
    );

  const busy = new Set<number>();
  for (const row of rows) {
    const meta = image_batch_metadata_schema.safeParse(row.metadata);
    if (!meta.success || meta.data.index === null) continue;
    if (indexes.includes(meta.data.index)) busy.add(meta.data.index);
  }
  if (busy.size > 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Unresolved batch already exists for index(es): ${[...busy].sort((a, b) => a - b).join(', ')}`
    });
  }
}

const trigger_batch_shloka_image_gen_route = protectedAdminProcedure
  .input(trigger_batch_input_schema)
  .mutation(async ({ input }) => {
    const {
      auto_approved,
      project_id,
      selected_text_levels,
      image_model,
      text_model,
      project_key,
      items
    } = input;

    const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
    const path_params = get_path_params(selected_text_levels, levels);
    if (levels > 1 && path_params.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid text path selection' });
    }
    const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));

    const indexes = items.map((item) => item.index);
    if (new Set(indexes).size !== indexes.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Duplicate indexes in batch request' });
    }

    await assertNoUnresolvedDuplicates(projectPath.id, indexes);

    // Resolve prompts in parallel (use provided, else generate)
    const resolved = await Promise.all(
      items.map(async (item) => {
        let image_prompt = item.image_prompt?.trim() ?? '';
        if (!image_prompt) {
          const generated = await get_image_prompt_func({
            project_key,
            selected_text_levels,
            index: item.index,
            model: text_model
          });
          if (!generated.image_prompt) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to generate image prompt for index ${item.index}`
            });
          }
          image_prompt = generated.image_prompt;
        }
        return {
          index: item.index,
          image_prompt,
          custom_id: getShlokaImageBatchCustomId(project_id, path_params, item.index)
        };
      })
    );

    const batch_requests: AiBatchInput[] = resolved.map((item) => ({
      type: 'image' as const,
      custom_id: item.custom_id,
      prompt: item.image_prompt,
      model: image_model,
      quality: 'medium' as const,
      size: '1024x1024' as const
    }));

    const { batch_id, input_file_id } = await createAiBatch(getOpenAI(), batch_requests);
    try {
      await db.transaction(async (tx) => {
        await tx.insert(ai_batches).values({
          batch_id,
          type: 'image',
          input_file_id
        });
        await tx.insert(ai_batch_responses).values(
          resolved.map((item) => ({
            batch_id,
            custom_id: item.custom_id,
            auto_approved,
            metadata: {
              type: 'shloka-image' as const,
              project_id,
              project_path_id: projectPath.id,
              path_params,
              index: item.index,
              image_prompt: item.image_prompt
            }
          }))
        );
      });
      await publishAiBatchResultsQueue({ batch_id, poll_attempt: 0 }, BATCH_POLLING_INTERVAL_S);
    } catch (err) {
      await db
        .delete(ai_batch_responses)
        .where(eq(ai_batch_responses.batch_id, batch_id))
        .catch((cleanup_err) => {
          console.error(`Failed to delete orphaned batch responses ${batch_id}:`, cleanup_err);
        });
      await db
        .delete(ai_batches)
        .where(eq(ai_batches.batch_id, batch_id))
        .catch((cleanup_err) => {
          console.error(`Failed to delete orphaned ai_batches row ${batch_id}:`, cleanup_err);
        });
      await getOpenAI()
        .batches.cancel(batch_id)
        .catch((cancel_err) => {
          console.error(`Failed to cancel orphaned OpenAI batch ${batch_id}:`, cancel_err);
        });
      throw err;
    }

    return { batch_id, item_count: resolved.length };
  });

const poll_batch_shloka_image_gen_route = protectedAdminProcedure
  .input(z.object({ batch_id: z.string() }))
  .mutation(async ({ input: { batch_id } }) => poll_batch_shloka_image_gen_func(batch_id));

const approve_shloka_image_route = protectedAdminProcedure
  .input(z.object({ batch_id: z.string(), custom_id: z.string() }))
  .mutation(async ({ input }) =>
    approve_connect_shloka_image_func(input.batch_id, input.custom_id)
  );

const discard_shloka_image_batch_response_route = protectedAdminProcedure
  .input(z.object({ batch_id: z.string(), custom_id: z.string() }))
  .mutation(async ({ input: { batch_id, custom_id } }) => {
    const row = await db.query.ai_batch_responses.findFirst({
      where: and(
        eq(ai_batch_responses.batch_id, batch_id),
        eq(ai_batch_responses.custom_id, custom_id)
      )
    });
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch response not found' });
    }
    const metadata = image_batch_metadata_schema.parse(row.metadata);
    let deleted_image_id: number | null = null;
    if (metadata.uploaded_image_id !== undefined) {
      await deleteImageAssetById(metadata.uploaded_image_id, { s3Client: getS3Client() });
      deleted_image_id = metadata.uploaded_image_id;
    }
    await db
      .delete(ai_batch_responses)
      .where(
        and(eq(ai_batch_responses.batch_id, batch_id), eq(ai_batch_responses.custom_id, custom_id))
      );
    scheduleOpenAiBatchCleanup(batch_id);
    return {
      success: true as const,
      deleted_image_id,
      project_path_id: metadata.project_path_id,
      index: metadata.index
    };
  });

type EnrichedBatchItem = {
  batch_id: string;
  custom_id: string;
  output_resolved: boolean;
  auto_approved: boolean;
  metadata: BatchMetadata;
  project_id: number;
  project_key: string | null;
  project_name: string | null;
  project_path_id: number;
  path: string | null;
  index: number | null;
  shloka_num: number | null;
  image_asset: {
    id: number;
    s3_key: string;
    url: string;
    width: number;
    height: number;
    description: string | null;
  } | null;
  status: ReturnType<typeof deriveImageBatchUiStatus>;
  openai_batch_url: string;
};

async function enrichBatchRows(
  rows: {
    batch_id: string;
    custom_id: string;
    output_resolved: boolean;
    auto_approved: boolean;
    metadata: BatchMetadata;
  }[]
): Promise<EnrichedBatchItem[]> {
  const project_ids = new Set<number>();
  const path_ids = new Set<number>();
  const image_ids = new Set<number>();
  for (const row of rows) {
    project_ids.add(row.metadata.project_id);
    path_ids.add(row.metadata.project_path_id);
    if (row.metadata.uploaded_image_id !== undefined) {
      image_ids.add(row.metadata.uploaded_image_id);
    }
  }

  const [project_rows, path_rows, assets, text_rows] = await Promise.all([
    project_ids.size
      ? db.query.projects.findMany({
          columns: { id: true, key: true, name: true },
          where: inArray(projects.id, [...project_ids])
        })
      : Promise.resolve([]),
    path_ids.size
      ? db.query.project_paths.findMany({
          columns: { id: true, path: true },
          where: inArray(project_paths.id, [...path_ids])
        })
      : Promise.resolve([]),
    image_ids.size
      ? db.query.image_assets.findMany({
          columns: {
            id: true,
            s3_key: true,
            width: true,
            height: true,
            description: true
          },
          where: inArray(image_assets.id, [...image_ids])
        })
      : Promise.resolve([]),
    path_ids.size
      ? db
          .select({
            project_path_id: texts.project_path_id,
            index: texts.index,
            shloka_num: texts.shloka_num
          })
          .from(texts)
          .where(inArray(texts.project_path_id, [...path_ids]))
      : Promise.resolve([])
  ]);

  const project_by_id = new Map(project_rows.map((p) => [p.id, p]));
  const path_by_id = new Map(path_rows.map((p) => [p.id, p]));
  const asset_by_id = new Map(assets.map((a) => [a.id, a]));
  const shloka_by_key = new Map(
    text_rows.map((t) => [`${t.project_path_id}:${t.index}`, t.shloka_num] as const)
  );

  return rows.map((row) => {
    const metadata = image_batch_metadata_schema.parse(row.metadata);
    const project = project_by_id.get(metadata.project_id);
    const path_row = path_by_id.get(metadata.project_path_id);
    const asset =
      metadata.uploaded_image_id !== undefined
        ? (asset_by_id.get(metadata.uploaded_image_id) ?? null)
        : null;
    return {
      batch_id: row.batch_id,
      custom_id: row.custom_id,
      output_resolved: row.output_resolved,
      auto_approved: row.auto_approved,
      metadata,
      project_id: metadata.project_id,
      project_key: project?.key ?? null,
      project_name: project?.name ?? null,
      project_path_id: metadata.project_path_id,
      path: path_row?.path ?? metadata.path_params.join(':'),
      index: metadata.index,
      shloka_num:
        metadata.index === null
          ? null
          : (shloka_by_key.get(`${metadata.project_path_id}:${metadata.index}`) ?? null),
      image_asset: asset
        ? {
            id: asset.id,
            s3_key: asset.s3_key,
            url: getCDNUrl(asset.s3_key),
            width: asset.width,
            height: asset.height,
            description: asset.description
          }
        : null,
      status: deriveImageBatchUiStatus(row.output_resolved, metadata, row.auto_approved),
      openai_batch_url: `https://platform.openai.com/batches/${row.batch_id}`
    };
  });
}

const get_shloka_image_batch_status_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable()),
      index: z.int().min(0).optional()
    })
  )
  .query(async ({ input }) => {
    const { levels } = await get_project_info_by_id(input.project_id, cache_db_options_app);
    const path_params = get_path_params(input.selected_text_levels, levels);
    if (levels > 1 && path_params.length === 0) return null;
    const projectPath = await requireProjectPath(db, input.project_id, path_params.join(':'));

    const rows = await db
      .select({
        batch_id: ai_batch_responses.batch_id,
        custom_id: ai_batch_responses.custom_id,
        output_resolved: ai_batches.output_resolved,
        auto_approved: ai_batch_responses.auto_approved,
        metadata: ai_batch_responses.metadata
      })
      .from(ai_batch_responses)
      .innerJoin(ai_batches, eq(ai_batch_responses.batch_id, ai_batches.batch_id))
      .where(
        and(
          eq(ai_batches.type, 'image'),
          sql`(${ai_batch_responses.metadata}->>'project_path_id')::int = ${projectPath.id}`
        )
      );

    const filtered = rows.filter((row) => {
      const meta = image_batch_metadata_schema.parse(row.metadata);
      if (input.index === undefined) return true;
      return meta.index === input.index;
    });
    if (filtered.length === 0) return null;

    const active_row =
      filtered.find((row) => !row.output_resolved) ??
      filtered.find(
        (row) =>
          row.output_resolved &&
          row.metadata.success === true &&
          row.metadata.uploaded_image_id !== undefined &&
          row.auto_approved
      ) ??
      filtered.find(
        (row) =>
          row.output_resolved &&
          row.metadata.success === true &&
          row.metadata.uploaded_image_id !== undefined &&
          !row.auto_approved
      ) ??
      filtered[filtered.length - 1]!;

    const [enriched] = await enrichBatchRows([
      {
        ...active_row,
        metadata: image_batch_metadata_schema.parse(active_row.metadata)
      }
    ]);
    return enriched ?? null;
  });

const get_batch_manager_groups_route = protectedAdminProcedure
  .input(
    z
      .object({
        project_id: z.int().optional(),
        project_path_id: z.int().optional()
      })
      .optional()
  )
  .query(async ({ input }) => {
    const batches = await db.query.ai_batches.findMany({
      where: eq(ai_batches.type, 'image'),
      orderBy: [desc(ai_batches.batch_id)],
      with: { responses: true }
    });

    let rows = batches.flatMap((batch) =>
      batch.responses.map((response) => ({
        batch_id: batch.batch_id,
        custom_id: response.custom_id,
        output_resolved: batch.output_resolved,
        auto_approved: response.auto_approved,
        metadata: image_batch_metadata_schema.parse(response.metadata)
      }))
    );

    if (input?.project_id !== undefined) {
      rows = rows.filter((row) => row.metadata.project_id === input.project_id);
    }
    if (input?.project_path_id !== undefined) {
      rows = rows.filter((row) => row.metadata.project_path_id === input.project_path_id);
    }

    const enriched = await enrichBatchRows(rows);
    const groups = new Map<string, { batch_id: string; items: EnrichedBatchItem[] }>();
    for (const item of enriched) {
      const existing = groups.get(item.batch_id);
      if (existing) existing.items.push(item);
      else groups.set(item.batch_id, { batch_id: item.batch_id, items: [item] });
    }

    return [...groups.values()].map((group) => {
      const counts = { pending: 0, ready: 0, failed: 0, auto_approved: 0 };
      for (const item of group.items) {
        if (item.status === 'processing') counts.pending++;
        else if (item.status === 'ready_for_review' || item.status === 'auto_applying')
          counts.ready++;
        else if (item.status === 'failed') counts.failed++;
        if (item.auto_approved) counts.auto_approved++;
      }
      return {
        ...group,
        counts,
        openai_batch_url: `https://platform.openai.com/batches/${group.batch_id}`
      };
    });
  });

export const batch_ai_router = t.router({
  trigger_batch_shloka_image_gen: trigger_batch_shloka_image_gen_route,
  poll_batch_shloka_image_gen: poll_batch_shloka_image_gen_route,
  approve_shloka_image: approve_shloka_image_route,
  discard_shloka_image_batch_response: discard_shloka_image_batch_response_route,
  get_shloka_image_batch_status: get_shloka_image_batch_status_route,
  get_batch_manager_groups: get_batch_manager_groups_route
});
