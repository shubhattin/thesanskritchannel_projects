import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { t, protectedProcedure, protectedAdminProcedure } from '../trpc_init';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { CACHE, invalidate_and_refresh_cached } from '~/utils/cache.server/cached_loader.server';
import { get_project_info_by_id } from '~/utils/project/list.server';
import { db } from '~/db/db';
import type { pgTransactionType } from '~/db/db_types';
import { media_attachment } from '~/db/schema';
import { get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/utils/project/paths_db.server';

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

const assert_unique_ids = (label: string, ids: number[]) => {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Duplicate id in ${label}` });
    }
    seen.add(id);
  }
};

const apply_multimedia_save = async (
  tx: pgTransactionType,
  project_path_id: number,
  { creates, updates, deletes, order_updates }: MediaSavePayload
) => {
  assert_unique_ids('deletes', deletes);
  assert_unique_ids(
    'updates',
    updates.map((row) => row.id)
  );
  assert_unique_ids(
    'order_updates',
    order_updates.map((row) => row.id)
  );

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
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Media link not found: ${id}` });
      }
    }
    for (const row of rows) {
      if (row.project_path_id !== project_path_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Media link ${row.id} does not belong to this path`
        });
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

  for (const update of updates) {
    const { id, ...fields } = update;
    if (Object.keys(fields).length === 0) continue;
    await tx.update(media_attachment).set(fields).where(eq(media_attachment.id, id));
  }

  for (const { id, order } of order_updates) {
    await tx.update(media_attachment).set({ order }).where(eq(media_attachment.id, id));
  }

  return { id_map };
};

const get_media_list_route = protectedProcedure
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .query(async ({ input: { project_id, selected_text_levels } }) => {
    const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
    const path_params = get_path_params(selected_text_levels, levels);
    return CACHE.media_links.get({ project_id, path_params }, cache_db_options_app);
  });

const save_project_multimedia_route = protectedAdminProcedure
  .input(save_project_multimedia_input_schema)
  .mutation(
    async ({
      input: { project_id, selected_text_levels, creates, updates, deletes, order_updates }
    }) => {
      const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
      const path_params = get_path_params(selected_text_levels, levels);

      const result = await db.transaction(async (tx) => {
        const projectPath = await requireProjectPath(tx, project_id, path_params.join(':'));
        return apply_multimedia_save(tx, projectPath.id, {
          creates,
          updates,
          deletes,
          order_updates
        });
      });

      await invalidate_and_refresh_cached(
        CACHE.media_links,
        { project_id, path_params },
        cache_db_options_app
      );

      return result;
    }
  );

export const media_router = t.router({
  get_media_list: get_media_list_route,
  save_project_multimedia: save_project_multimedia_route
});
