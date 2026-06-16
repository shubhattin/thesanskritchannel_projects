import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { media_attachment } from '~/db/schema';
import type { pgTransactionType } from '~/db/db_types';
import type { media_list_type } from '~/db/schema';

export type MultimediaCreateInput = {
  client_id: string;
  media_type: media_list_type;
  link: string;
  name: string;
  lang_id: number | null;
  order: number;
};

export type MultimediaUpdateInput = {
  id: number;
  media_type?: media_list_type;
  link?: string;
  name?: string;
  lang_id?: number | null;
};

export type MultimediaOrderUpdate = {
  id: number;
  order: number;
};

export type ApplyMultimediaSaveInput = {
  creates: MultimediaCreateInput[];
  updates: MultimediaUpdateInput[];
  deletes: number[];
  order_updates: MultimediaOrderUpdate[];
};

const assert_unique_ids = (label: string, ids: number[]) => {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Duplicate id in ${label}` });
    }
    seen.add(id);
  }
};

export const apply_multimedia_save = async (
  tx: pgTransactionType,
  project_path_id: number,
  input: ApplyMultimediaSaveInput
) => {
  const { creates, updates, deletes, order_updates } = input;

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
    const existing = await tx
      .select({ id: media_attachment.id })
      .from(media_attachment)
      .where(inArray(media_attachment.id, unique_touched));
    const existing_ids = new Set(existing.map((row) => row.id));
    for (const id of unique_touched) {
      if (!existing_ids.has(id)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Media link not found: ${id}` });
      }
    }
    const foreign = await tx
      .select({ id: media_attachment.id, project_path_id: media_attachment.project_path_id })
      .from(media_attachment)
      .where(inArray(media_attachment.id, unique_touched));
    for (const row of foreign) {
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

  for (const create of creates) {
    const [inserted] = await tx
      .insert(media_attachment)
      .values({
        project_path_id,
        media_type: create.media_type,
        link: create.link,
        name: create.name,
        lang_id: create.lang_id,
        order: create.order
      })
      .returning();
    id_map[create.client_id] = inserted.id;
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
