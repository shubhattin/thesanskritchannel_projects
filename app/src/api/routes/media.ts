import { Effect } from 'effect';
import { inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { t, protectedProcedure, protectedAdminProcedure } from '../trpc_init';
import { CACHE, invalidate_and_refresh_cached } from '~/utils/cache.server/cached_loader.server';
import { get_project_info_by_id } from '~/utils/project/list.server';
import { dbTransaction, type TxOrDb } from '~/effect/database';
import { BadRequestError, NotFoundError } from '~/effect/errors';
import { media_attachment } from '~/db/schema';
import { get_path_params } from '~/state/project_list';
import { runTrpcEffect } from '~/effect/app_runtime.server';

const media_type_schema = z.enum(['pdf', 'text', 'video', 'audio']);

const media_create_schema = z.object({
  client_id: z.uuid(),
  media_type: media_type_schema,
  link: z.url(),
  name: z.string().min(1),
  lang_id: z.int().nullable(),
  order: z.int().min(0)
});

const media_update_schema = z
  .object({
    id: z.int(),
    media_type: media_type_schema.optional(),
    link: z.url().optional(),
    name: z.string().min(1).optional(),
    lang_id: z.int().nullable().optional()
  })
  .refine(
    (data) =>
      data.media_type !== undefined ||
      data.link !== undefined ||
      data.name !== undefined ||
      data.lang_id !== undefined,
    { message: 'Update must include at least one field' }
  );

const media_order_update_schema = z.object({
  id: z.int(),
  order: z.int().min(0)
});

const save_project_multimedia_input_schema = z.object({
  project_id: z.int(),
  selected_text_levels: z.array(z.int().nullable()),
  creates: z.array(media_create_schema).default([]),
  updates: z.array(media_update_schema).default([]),
  deletes: z.array(z.int()).default([]),
  order_updates: z.array(media_order_update_schema).default([])
});

type MediaSavePayload = Pick<
  z.infer<typeof save_project_multimedia_input_schema>,
  'creates' | 'updates' | 'deletes' | 'order_updates'
>;

type MultimediaSaveOutcome =
  | { ok: true; id_map: Record<string, number> }
  | { ok: false; reason: 'bad_request' | 'path_not_found'; message: string };

const assert_unique_ids = (
  label: string,
  ids: number[]
): { ok: true } | { ok: false; message: string } => {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) {
      return { ok: false, message: `Duplicate id in ${label}` };
    }
    seen.add(id);
  }
  return { ok: true };
};

/**
 * Apply multimedia creates/updates/deletes/order on a project path.
 * Returns a domain failure instead of throwing so callers can map to Effect errors.
 */
const apply_multimedia_save = async (
  tx: TxOrDb,
  project_path_id: number,
  { creates, updates, deletes, order_updates }: MediaSavePayload
): Promise<MultimediaSaveOutcome> => {
  for (const check of [
    assert_unique_ids('deletes', deletes),
    assert_unique_ids(
      'updates',
      updates.map((row) => row.id)
    ),
    assert_unique_ids(
      'order_updates',
      order_updates.map((row) => row.id)
    )
  ]) {
    if (!check.ok) {
      return { ok: false, reason: 'bad_request', message: check.message };
    }
  }

  const touched_ids = [
    ...deletes,
    ...updates.map((row) => row.id),
    ...order_updates.map((row) => row.id)
  ];
  if (touched_ids.length > 0) {
    const unique_touched = [...new Set(touched_ids)];
    const rows = await tx
      .select({ id: media_attachment.id, project_path_id: media_attachment.project_path_id })
      .from(media_attachment)
      .where(inArray(media_attachment.id, unique_touched));
    const existing_ids = new Set(rows.map((row) => row.id));
    for (const id of unique_touched) {
      if (!existing_ids.has(id)) {
        return {
          ok: false,
          reason: 'bad_request',
          message: `Media link not found: ${id}`
        };
      }
    }
    for (const row of rows) {
      if (row.project_path_id !== project_path_id) {
        return {
          ok: false,
          reason: 'bad_request',
          message: `Media link ${row.id} does not belong to this path`
        };
      }
    }
  }

  const id_map: Record<string, number> = {};

  if (deletes.length > 0) {
    await tx.delete(media_attachment).where(inArray(media_attachment.id, deletes));
  }

  if (creates.length > 0) {
    const inserted = await tx
      .insert(media_attachment)
      .values(
        creates.map((create) => ({
          project_path_id,
          media_type: create.media_type,
          link: create.link,
          name: create.name,
          lang_id: create.lang_id,
          order: create.order
        }))
      )
      .returning();
    for (let i = 0; i < creates.length; i++) {
      id_map[creates[i].client_id] = inserted[i].id;
    }
  }

  if (updates.length > 0) {
    // Single statement — do not Promise.all on the same tx connection (neon/postgres-js).
    const value_rows = updates.map(
      (u) => sql`(
        ${u.id}::int,
        ${u.media_type ?? null}::text,
        ${u.link ?? null}::text,
        ${u.name ?? null}::text,
        ${u.lang_id !== undefined ? u.lang_id : null}::int,
        ${u.lang_id !== undefined}::boolean
      )`
    );
    await tx.execute(sql`
      UPDATE ${media_attachment} AS t
      SET
        media_type = COALESCE(v.media_type::media_type_enum, t.media_type),
        link = COALESCE(v.link, t.link),
        name = COALESCE(v.name, t.name),
        lang_id = CASE WHEN v.set_lang THEN v.lang_id ELSE t.lang_id END,
        updated_at = now()
      FROM (VALUES ${sql.join(value_rows, sql`, `)}) AS v(id, media_type, link, name, lang_id, set_lang)
      WHERE t.id = v.id
    `);
  }

  if (order_updates.length > 0) {
    const value_rows = order_updates.map(({ id, order }) => sql`(${id}::int, ${order}::int)`);
    await tx.execute(sql`
      UPDATE ${media_attachment} AS t
      SET "order" = v.ord, updated_at = now()
      FROM (VALUES ${sql.join(value_rows, sql`, `)}) AS v(id, ord)
      WHERE t.id = v.id
    `);
  }

  return { ok: true, id_map };
};

const get_media_list_route = protectedProcedure
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .query(({ input: { project_id, selected_text_levels } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const { levels } = yield* get_project_info_by_id(project_id);
        const path_params = get_path_params(selected_text_levels, levels);
        return yield* CACHE.media_links.get({ project_id, path_params });
      })
    )
  );

const save_project_multimedia_route = protectedAdminProcedure
  .input(save_project_multimedia_input_schema)
  .mutation(
    ({ input: { project_id, selected_text_levels, creates, updates, deletes, order_updates } }) =>
      runTrpcEffect(
        Effect.gen(function* () {
          const { levels } = yield* get_project_info_by_id(project_id);
          const path_params = get_path_params(selected_text_levels, levels);
          const path = path_params.join(':');

          const outcome = yield* dbTransaction('media.tx.1', async (tx) => {
            const projectPath = await tx.query.project_paths.findFirst({
              where: (tbl, { and: andOp, eq: eqOp }) =>
                andOp(eqOp(tbl.project_id, project_id), eqOp(tbl.path, path)),
              columns: { id: true, project_id: true, path: true }
            });
            if (!projectPath) {
              return {
                ok: false as const,
                reason: 'path_not_found' as const,
                message: `Project path not found: ${path}`
              };
            }
            return apply_multimedia_save(tx, projectPath.id, {
              creates,
              updates,
              deletes,
              order_updates
            });
          });

          if (!outcome.ok) {
            if (outcome.reason === 'path_not_found') {
              return yield* Effect.fail(
                NotFoundError.make({
                  resource: 'project_path',
                  message: outcome.message
                })
              );
            }
            return yield* Effect.fail(BadRequestError.make({ message: outcome.message }));
          }

          yield* invalidate_and_refresh_cached(CACHE.media_links, { project_id, path_params });
          return { id_map: outcome.id_map };
        })
      )
  );

export const media_router = t.router({
  get_media_list: get_media_list_route,
  save_project_multimedia: save_project_multimedia_route
});
