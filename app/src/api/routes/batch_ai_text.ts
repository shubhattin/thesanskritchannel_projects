import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import {
  ai_batches,
  ai_batch_responses,
  project_paths,
  projects,
  texts,
  translations
} from '~/db/schema';
import { createAiBatch, getAiBatchResult, type AiBatchInput } from '~/utils/ai_batch';
import type { AiBatchPollingStatus } from '~/utils/ai_batch/types';
import { getTextTranslationBatchCustomId } from '~/utils/ai_batch/batch_custom_id';
import {
  deriveTranslationBatchUiStatus,
  type TranslationBatchUiStatus
} from '~/utils/ai_batch/batch_translation_status';
import {
  batch_translation_object_schema,
  mapPositionalTranslationsToDbIndexes
} from '~/utils/ai_batch/translation_result';
import {
  getOpenAI,
  isResponseItemProcessed,
  markBatchOutputResolvedIfComplete,
  scheduleOpenAiBatchCleanup,
  tryClaimBatchRow,
  updateBatchResponse
} from '~/utils/ai_batch/batch_lifecycle.server';
import {
  BATCH_POLLING_INTERVAL_S,
  text_translation_batch_metadata_schema,
  type TextTranslationBatchMetadata
} from '~/utils/types/ai_batch_metadata';
import { publishAiBatchResultsQueue } from '~/utils/qstash';
import { get_project_info_by_id, get_project_map_by_id } from '~/utils/project/list.server';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { get_node_at_path, get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/utils/project/paths_db.server';
import { build_translation_prompts } from '~/api/routes/ai/translation_prompt_builder';
import {
  path_params_to_selected_text_levels,
  persist_translations_for_path
} from '~/api/routes/translation';
import { lang_list_obj, get_lang_from_id } from '~/state/lang_list';
import { CACHE } from '~/utils/cache.server/cached_loader.server';
import type { recursive_list_type } from '~/state/data_types';

/** Soft char budget for one leaf request (gpt-5.2 ~400K tokens; leave headroom). */
const MAX_TRANSLATION_PROMPT_CHARS = 280_000;

const TERMINAL_FAILURE_STATUSES: ReadonlySet<AiBatchPollingStatus> = new Set([
  'failed',
  'expired',
  'cancelled'
]);

type PollItem = {
  custom_id: string;
  success: boolean;
  message?: string;
};

type PollCoreResult =
  | { status: 'pending'; batch_id: string; openai_status: AiBatchPollingStatus }
  | { status: 'terminal_failure'; batch_id: string; openai_status: AiBatchPollingStatus }
  | { status: 'already_resolved'; batch_id: string; items: PollItem[] }
  | { status: 'processed'; batch_id: string; items: PollItem[] };

export type PollBatchTextTranslationResult = PollCoreResult & { message: string };

function toPollItem(custom_id: string, metadata: TextTranslationBatchMetadata): PollItem {
  return {
    custom_id,
    success: metadata.success === true
  };
}

function buildProcessedMessage(items: PollItem[]) {
  const succeeded = items.filter((item) => item.success).length;
  const auto_saved = items.filter((item) => item.message?.startsWith('Auto-saved')).length;
  const failed = items.length - succeeded;
  const parts = [`${succeeded}/${items.length} batch item(s) succeeded`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (auto_saved > 0) parts.push(`${auto_saved} auto-saved`);
  return parts.join('; ') + '.';
}

async function load_leaf_text_context(args: {
  project_id: number;
  project_key: string;
  path_params: number[];
  lang_id: number;
  include_english_context: boolean;
}) {
  const { project_id, project_key, path_params, lang_id, include_english_context } = args;
  const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
  const text_rows = await CACHE.text_data.get(
    { key: project_key, path_params },
    cache_db_options_app
  );
  if (!text_rows.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `No text rows found for path ${path_params.join(':') || '(root)'}`
    });
  }

  const { levels, name: text_name } = await get_project_info_by_id(
    project_id,
    cache_db_options_app
  );
  const selected_text_levels = path_params_to_selected_text_levels(path_params, levels);

  let english_map: Map<number, string> | undefined;
  if (include_english_context && lang_id !== lang_list_obj.English) {
    english_map = await CACHE.translation.get(
      {
        project_id,
        lang_id: lang_list_obj.English,
        selected_text_levels
      },
      cache_db_options_app
    );
  }

  const text_data = text_rows.map((row) => {
    const english_translation = english_map?.get(row.index);
    return {
      index: row.index,
      text: row.text,
      ...(english_translation !== undefined ? { english_translation } : {})
    };
  });

  const prompts = build_translation_prompts({
    lang_id,
    text_name,
    text_data
  });

  const prompt_chars = prompts.system_prompt.length + prompts.user_prompt.length;
  if (prompt_chars > MAX_TRANSLATION_PROMPT_CHARS) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Path ${path_params.join(':') || '(root)'} is too large for one batch request (${prompt_chars} chars). Split the leaf or translate manually.`
    });
  }

  return {
    projectPath,
    text_rows,
    source_indexes: text_rows.map((row) => row.index),
    prompts,
    selected_text_levels
  };
}

async function assertNoUnresolvedTranslationDuplicates(
  project_path_ids: number[],
  lang_id: number
) {
  if (project_path_ids.length === 0) return;
  const rows = await db
    .select({
      metadata: ai_batch_responses.metadata,
      batch_id: ai_batch_responses.batch_id
    })
    .from(ai_batch_responses)
    .innerJoin(ai_batches, eq(ai_batch_responses.batch_id, ai_batches.batch_id))
    .where(
      and(
        eq(ai_batches.type, 'object'),
        eq(ai_batches.output_resolved, false),
        sql`(${ai_batch_responses.metadata}->>'type') = 'text-translation'`,
        sql`(${ai_batch_responses.metadata}->>'lang_id')::int = ${lang_id}`,
        inArray(sql`(${ai_batch_responses.metadata}->>'project_path_id')::int`, project_path_ids)
      )
    );

  const busy_paths = new Set<number>();
  for (const row of rows) {
    const meta = text_translation_batch_metadata_schema.safeParse(row.metadata);
    if (!meta.success) continue;
    busy_paths.add(meta.data.project_path_id);
  }
  if (busy_paths.size > 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Unresolved translation batch already exists for ${busy_paths.size} path(s) in this language`
    });
  }
}

/** Connect staged translations into the translations table and remove the batch response row. */
export const approve_text_translation_func = async (batch_id: string, custom_id: string) => {
  const ai_batch_data = await db.query.ai_batch_responses.findFirst({
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
  const metadata = text_translation_batch_metadata_schema.parse(ai_batch_data.metadata);
  if (metadata.success !== true || metadata.translated_data === undefined) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Translation not ready for batch_id ${batch_id} and custom_id ${custom_id}`
    });
  }

  await persist_translations_for_path({
    project_id: metadata.project_id,
    lang_id: metadata.lang_id,
    project_path_id: metadata.project_path_id,
    path_params: metadata.path_params,
    indexes: metadata.translated_data.map((row) => row.index),
    data: metadata.translated_data.map((row) => row.text)
  });

  await db
    .delete(ai_batch_responses)
    .where(
      and(eq(ai_batch_responses.batch_id, batch_id), eq(ai_batch_responses.custom_id, custom_id))
    );

  scheduleOpenAiBatchCleanup(batch_id);
  return {
    success: true as const,
    project_path_id: metadata.project_path_id,
    lang_id: metadata.lang_id,
    item_count: metadata.translated_data.length
  };
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
        const result = await approve_text_translation_func(batch_id, item.custom_id);
        return {
          ...item,
          message: `Auto-saved ${result.item_count} translation(s) to path ${result.project_path_id} lang ${result.lang_id}`
        };
      } catch (err) {
        const message =
          err instanceof TRPCError ? err.message : 'Auto-approve failed to save translations';
        return { ...item, message };
      }
    })
  );
}

export const poll_batch_text_translation_func = async (
  batch_id: string
): Promise<PollBatchTextTranslationResult> => {
  const ai_batch = await db.query.ai_batches.findFirst({
    where: eq(ai_batches.batch_id, batch_id),
    with: { responses: true }
  });
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
        toPollItem(row.custom_id, text_translation_batch_metadata_schema.parse(row.metadata))
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
    outputs: db_rows.map((row) => ({
      type: 'object' as const,
      custom_id: row.custom_id,
      output_schema: batch_translation_object_schema
    }))
  });
  const batch_output_file_id = batch.output_file_id ?? null;

  if (batch.status !== 'completed') {
    const openai_status = batch.status;
    if (TERMINAL_FAILURE_STATUSES.has(openai_status)) {
      await db.transaction(async (tx) => {
        await Promise.all(
          db_rows
            .filter(
              (row) =>
                !isResponseItemProcessed(text_translation_batch_metadata_schema.parse(row.metadata))
            )
            .map((row) =>
              updateBatchResponse(
                tx,
                batch_id,
                row.custom_id,
                {
                  ...text_translation_batch_metadata_schema.parse(row.metadata),
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

  const items = (
    await Promise.all(
      db_rows.map(async (row): Promise<PollItem | null> => {
        const row_metadata = text_translation_batch_metadata_schema.parse(row.metadata);
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
            const resolved_metadata = text_translation_batch_metadata_schema.parse(
              resolved_row.metadata
            );
            if (isResponseItemProcessed(resolved_metadata)) {
              return toPollItem(resolved_row.custom_id, resolved_metadata);
            }
          }
          return null;
        }

        const metadata = text_translation_batch_metadata_schema.parse(claimed_row.metadata);
        const output = output_by_custom_id.get(row.custom_id);

        if (!output || !output.success || output.type !== 'object' || output.data == null) {
          const wrote = await db.transaction(async (tx) =>
            updateBatchResponse(tx, batch_id, row.custom_id, {
              ...metadata,
              success: false
            })
          );
          return wrote ? { custom_id: row.custom_id, success: false } : null;
        }

        const parsed = batch_translation_object_schema.safeParse(output.data);
        const mapped = parsed.success
          ? mapPositionalTranslationsToDbIndexes(parsed.data.translations, metadata.source_indexes)
          : null;

        if (!mapped) {
          const wrote = await db.transaction(async (tx) =>
            updateBatchResponse(tx, batch_id, row.custom_id, {
              ...metadata,
              success: false
            })
          );
          return wrote
            ? {
                custom_id: row.custom_id,
                success: false,
                message: 'Translation rejected: length or index mismatch'
              }
            : null;
        }

        const persisted = await db.transaction(async (tx) =>
          updateBatchResponse(
            tx,
            batch_id,
            row.custom_id,
            {
              ...metadata,
              success: true,
              translated_data: mapped
            },
            batch_output_file_id
          )
        );

        if (!persisted) return null;

        return {
          custom_id: row.custom_id,
          success: true
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

const trigger_path_schema = z.object({
  path_params: z.number().int().array()
});

const trigger_batch_text_translation_input = z.object({
  auto_approved: z.boolean().default(true),
  include_english_context: z.boolean().default(false),
  project_id: z.int(),
  project_key: z.string(),
  lang_id: z.int(),
  paths: z.array(trigger_path_schema).min(1)
});

const trigger_batch_text_translation_route = protectedAdminProcedure
  .input(trigger_batch_text_translation_input)
  .mutation(async ({ input }) => {
    const { auto_approved, include_english_context, project_id, project_key, lang_id, paths } =
      input;

    const path_keys = paths.map((p) => p.path_params.join(':'));
    if (new Set(path_keys).size !== path_keys.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Duplicate paths in batch request' });
    }

    const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
    const map = await get_project_map_by_id(project_id, cache_db_options_app);

    for (const path of paths) {
      if (levels > 1 && path.path_params.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid text path selection' });
      }
      if (path.path_params.length !== levels - 1 && levels > 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Path ${path.path_params.join(':')} is not a leaf path`
        });
      }
      const node = get_node_at_path(map, path.path_params);
      if (!node || node.info.type !== 'shloka') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Path ${path.path_params.join(':') || '(root)'} is not a leaf text node`
        });
      }
    }

    const resolved = await Promise.all(
      paths.map(async (path) => {
        const ctx = await load_leaf_text_context({
          project_id,
          project_key,
          path_params: path.path_params,
          lang_id,
          include_english_context
        });
        return {
          path_params: path.path_params,
          project_path_id: ctx.projectPath.id,
          source_indexes: ctx.source_indexes,
          prompts: ctx.prompts,
          custom_id: getTextTranslationBatchCustomId(project_id, path.path_params)
        };
      })
    );

    await assertNoUnresolvedTranslationDuplicates(
      resolved.map((item) => item.project_path_id),
      lang_id
    );

    const batch_requests: AiBatchInput[] = resolved.map((item) => ({
      type: 'object' as const,
      custom_id: item.custom_id,
      model: 'gpt-5.2',
      instructions: item.prompts.system_prompt,
      input: item.prompts.user_prompt,
      output_schema: batch_translation_object_schema,
      output_schema_name: 'translations_text_schema',
      reasoning: { effort: 'low' as const }
    }));

    const { batch_id, input_file_id } = await createAiBatch(getOpenAI(), batch_requests);
    try {
      await db.transaction(async (tx) => {
        await tx.insert(ai_batches).values({
          batch_id,
          type: 'object',
          input_file_id
        });
        await tx.insert(ai_batch_responses).values(
          resolved.map((item) => ({
            batch_id,
            custom_id: item.custom_id,
            auto_approved,
            metadata: {
              type: 'text-translation' as const,
              project_id,
              project_path_id: item.project_path_id,
              path_params: item.path_params,
              lang_id,
              include_english_context,
              source_indexes: item.source_indexes
            } satisfies TextTranslationBatchMetadata
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

const poll_batch_text_translation_route = protectedAdminProcedure
  .input(z.object({ batch_id: z.string() }))
  .mutation(async ({ input: { batch_id } }) => poll_batch_text_translation_func(batch_id));

const approve_text_translation_route = protectedAdminProcedure
  .input(z.object({ batch_id: z.string(), custom_id: z.string() }))
  .mutation(async ({ input }) => approve_text_translation_func(input.batch_id, input.custom_id));

const discard_text_translation_batch_response_route = protectedAdminProcedure
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
    const metadata = text_translation_batch_metadata_schema.parse(row.metadata);
    await db
      .delete(ai_batch_responses)
      .where(
        and(eq(ai_batch_responses.batch_id, batch_id), eq(ai_batch_responses.custom_id, custom_id))
      );
    scheduleOpenAiBatchCleanup(batch_id);
    return {
      success: true as const,
      project_path_id: metadata.project_path_id,
      lang_id: metadata.lang_id
    };
  });

type EnrichedTranslationBatchItem = {
  batch_type: 'text-translation';
  batch_id: string;
  custom_id: string;
  output_resolved: boolean;
  auto_approved: boolean;
  metadata: TextTranslationBatchMetadata;
  project_id: number;
  project_key: string | null;
  project_name: string | null;
  project_path_id: number;
  path: string | null;
  lang_id: number;
  lang_name: string | null;
  source_texts: { index: number; text: string; shloka_num: number | null }[];
  translated_data: TextTranslationBatchMetadata['translated_data'];
  status: TranslationBatchUiStatus;
  openai_batch_url: string;
};

async function enrichTranslationBatchRows(
  rows: {
    batch_id: string;
    custom_id: string;
    output_resolved: boolean;
    auto_approved: boolean;
    metadata: TextTranslationBatchMetadata;
  }[]
): Promise<EnrichedTranslationBatchItem[]> {
  const project_ids = new Set<number>();
  const path_ids = new Set<number>();
  for (const row of rows) {
    project_ids.add(row.metadata.project_id);
    path_ids.add(row.metadata.project_path_id);
  }

  const [project_rows, path_rows, text_rows] = await Promise.all([
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
    path_ids.size
      ? db
          .select({
            project_path_id: texts.project_path_id,
            index: texts.index,
            text: texts.text,
            shloka_num: texts.shloka_num
          })
          .from(texts)
          .where(inArray(texts.project_path_id, [...path_ids]))
          .orderBy(texts.project_path_id, texts.index)
      : Promise.resolve([])
  ]);

  const project_by_id = new Map(project_rows.map((p) => [p.id, p]));
  const path_by_id = new Map(path_rows.map((p) => [p.id, p]));
  const texts_by_path = new Map<number, typeof text_rows>();
  for (const row of text_rows) {
    const list = texts_by_path.get(row.project_path_id) ?? [];
    list.push(row);
    texts_by_path.set(row.project_path_id, list);
  }

  return rows.map((row) => {
    const metadata = text_translation_batch_metadata_schema.parse(row.metadata);
    const project = project_by_id.get(metadata.project_id);
    const path_row = path_by_id.get(metadata.project_path_id);
    const source_all = texts_by_path.get(metadata.project_path_id) ?? [];
    const source_indexes = new Set(metadata.source_indexes);
    const source_texts = source_all
      .filter((t) => source_indexes.has(t.index))
      .map((t) => ({ index: t.index, text: t.text, shloka_num: t.shloka_num }));

    let lang_name: string | null = null;
    try {
      lang_name = get_lang_from_id(metadata.lang_id);
    } catch {
      lang_name = null;
    }

    return {
      batch_type: 'text-translation' as const,
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
      lang_id: metadata.lang_id,
      lang_name,
      source_texts,
      translated_data: metadata.translated_data,
      status: deriveTranslationBatchUiStatus(row.output_resolved, metadata, row.auto_approved),
      openai_batch_url: `https://platform.openai.com/batches/${row.batch_id}`
    };
  });
}

const get_text_translation_batch_status_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.int(),
      lang_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
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
          eq(ai_batches.type, 'object'),
          sql`(${ai_batch_responses.metadata}->>'type') = 'text-translation'`,
          sql`(${ai_batch_responses.metadata}->>'project_path_id')::int = ${projectPath.id}`,
          sql`(${ai_batch_responses.metadata}->>'lang_id')::int = ${input.lang_id}`
        )
      );

    if (rows.length === 0) return null;

    const parsed_rows = rows.map((row) => ({
      ...row,
      metadata: text_translation_batch_metadata_schema.parse(row.metadata)
    }));

    const active_row =
      parsed_rows.find((row) => !row.output_resolved) ??
      parsed_rows.find(
        (row) =>
          row.output_resolved &&
          row.metadata.success === true &&
          row.metadata.translated_data !== undefined &&
          row.auto_approved
      ) ??
      parsed_rows.find(
        (row) =>
          row.output_resolved &&
          row.metadata.success === true &&
          row.metadata.translated_data !== undefined &&
          !row.auto_approved
      ) ??
      parsed_rows[parsed_rows.length - 1]!;

    const [enriched] = await enrichTranslationBatchRows([active_row]);
    return enriched ?? null;
  });

function collect_leaf_siblings(
  map: recursive_list_type,
  parent_path_params: number[]
): { path_params: number[]; value: number; name_dev: string; text_count: number }[] {
  const parent = get_node_at_path(map, parent_path_params);
  if (!parent || parent.info.type !== 'list') return [];

  const leaves: {
    path_params: number[];
    value: number;
    name_dev: string;
    text_count: number;
  }[] = [];

  for (let i = 0; i < (parent.list?.length ?? 0); i++) {
    const child = parent.list![i]!;
    if (child.info.type !== 'shloka') continue;
    leaves.push({
      path_params: [...parent_path_params, i + 1],
      value: i + 1,
      name_dev: child.name_dev,
      text_count: child.info.total
    });
  }
  return leaves;
}

const list_batch_translation_targets_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.int(),
      lang_id: z.int(),
      /** Current selected_text_levels; used to resolve the second-to-last parent path */
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .query(async ({ input }) => {
    const { levels } = await get_project_info_by_id(input.project_id, cache_db_options_app);
    const map = await get_project_map_by_id(input.project_id, cache_db_options_app);

    // Second-to-last selector is at selected_text_levels[1] when levels > 2,
    // or root children when levels === 2. Parent path omits the leaf segment.
    const full_path = get_path_params(input.selected_text_levels, levels);
    if (levels <= 1) {
      // Single-level project: only the root leaf
      const root = map;
      if (root.info.type !== 'shloka') return { leaves: [], current_value: null as number | null };
      const has_existing = (
        await db
          .select({ index: translations.index })
          .from(translations)
          .innerJoin(project_paths, eq(translations.project_path_id, project_paths.id))
          .where(
            and(
              eq(project_paths.project_id, input.project_id),
              eq(project_paths.path, ''),
              eq(translations.lang_id, input.lang_id)
            )
          )
          .limit(1)
      ).length;
      return {
        leaves: [
          {
            path_params: [] as number[],
            value: 0,
            name_dev: root.name_dev,
            text_count: root.info.total,
            has_existing_translations: has_existing > 0
          }
        ],
        current_value: 0
      };
    }

    const parent_path_params = full_path.slice(0, -1);
    const current_value = full_path[full_path.length - 1] ?? null;
    const leaves = collect_leaf_siblings(map, parent_path_params);

    const path_strings = leaves.map((leaf) => leaf.path_params.join(':'));
    const existing_paths = new Set<string>();
    if (path_strings.length > 0) {
      const path_rows = await db.query.project_paths.findMany({
        columns: { id: true, path: true },
        where: and(
          eq(project_paths.project_id, input.project_id),
          inArray(project_paths.path, path_strings)
        )
      });
      if (path_rows.length > 0) {
        const path_id_to_path = new Map(path_rows.map((p) => [p.id, p.path]));
        const existing = await db
          .selectDistinct({ project_path_id: translations.project_path_id })
          .from(translations)
          .where(
            and(
              eq(translations.lang_id, input.lang_id),
              inArray(
                translations.project_path_id,
                path_rows.map((p) => p.id)
              ),
              sql`${translations.text} != ''`
            )
          );
        for (const row of existing) {
          const path = path_id_to_path.get(row.project_path_id);
          if (path !== undefined) existing_paths.add(path);
        }
      }
    }

    return {
      leaves: leaves.map((leaf) => ({
        ...leaf,
        has_existing_translations: existing_paths.has(leaf.path_params.join(':'))
      })),
      current_value
    };
  });

const get_text_translation_batch_manager_groups_route = protectedAdminProcedure
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
      where: eq(ai_batches.type, 'object'),
      orderBy: [desc(ai_batches.batch_id)],
      with: { responses: true }
    });

    let rows = batches.flatMap((batch) =>
      batch.responses
        .map((response) => {
          const parsed = text_translation_batch_metadata_schema.safeParse(response.metadata);
          if (!parsed.success) return null;
          return {
            batch_id: batch.batch_id,
            custom_id: response.custom_id,
            output_resolved: batch.output_resolved,
            auto_approved: response.auto_approved,
            metadata: parsed.data
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
    );

    if (input?.project_id !== undefined) {
      rows = rows.filter((row) => row.metadata.project_id === input.project_id);
    }
    if (input?.project_path_id !== undefined) {
      rows = rows.filter((row) => row.metadata.project_path_id === input.project_path_id);
    }

    const enriched = await enrichTranslationBatchRows(rows);
    const groups = new Map<string, { batch_id: string; items: EnrichedTranslationBatchItem[] }>();
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
        batch_type: 'text-translation' as const,
        ...group,
        counts,
        openai_batch_url: `https://platform.openai.com/batches/${group.batch_id}`
      };
    });
  });

export const trigger_batch_text_translation = trigger_batch_text_translation_route;
export const poll_batch_text_translation = poll_batch_text_translation_route;
export const approve_text_translation = approve_text_translation_route;
export const discard_text_translation_batch_response =
  discard_text_translation_batch_response_route;
export const get_text_translation_batch_status = get_text_translation_batch_status_route;
export const list_batch_translation_targets = list_batch_translation_targets_route;
export const get_text_translation_batch_manager_groups =
  get_text_translation_batch_manager_groups_route;

export const batch_ai_text_router = t.router({
  trigger_batch_text_translation: trigger_batch_text_translation_route,
  poll_batch_text_translation: poll_batch_text_translation_route,
  approve_text_translation: approve_text_translation_route,
  discard_text_translation_batch_response: discard_text_translation_batch_response_route,
  get_text_translation_batch_status: get_text_translation_batch_status_route,
  list_batch_translation_targets: list_batch_translation_targets_route,
  get_text_translation_batch_manager_groups: get_text_translation_batch_manager_groups_route
});
