import { z } from 'zod';
import type { media_list_type } from './index';

export type MediaLinkRow = {
  id: number;
  lang_id: number | null;
  media_type: string;
  link: string;
  name: string;
  order: number;
};

export type DraftMediaItem = {
  id: number | string;
  lang_id: number | null;
  media_type: media_list_type;
  link: string;
  name: string;
};

export type MediaTab = 'all' | media_list_type;

export type MultimediaDiff = {
  creates: {
    client_id: string;
    media_type: media_list_type;
    link: string;
    name: string;
    lang_id: number | null;
    order: number;
  }[];
  updates: {
    id: number;
    media_type?: media_list_type;
    link?: string;
    name?: string;
    lang_id?: number | null;
  }[];
  deletes: number[];
  order_updates: { id: number; order: number }[];
};

export function getYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function is_new_draft_item(item: DraftMediaItem): boolean {
  return typeof item.id === 'string';
}

export function baseline_to_draft(rows: MediaLinkRow[]): DraftMediaItem[] {
  return rows.map((row) => ({
    id: row.id,
    lang_id: row.lang_id,
    media_type: row.media_type as media_list_type,
    link: row.link,
    name: row.name
  }));
}

export function clone_draft(items: DraftMediaItem[]): DraftMediaItem[] {
  return items.map((item) => ({ ...item }));
}

export function create_empty_draft_item(): DraftMediaItem {
  return {
    id: crypto.randomUUID(),
    lang_id: 1,
    media_type: 'video',
    link: '',
    name: ''
  };
}

export function move_draft_item(
  draft: DraftMediaItem[],
  from: number,
  to: number
): DraftMediaItem[] {
  if (from === to || from < 0 || to < 0 || from >= draft.length || to >= draft.length) {
    return draft;
  }
  const next = [...draft];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function baseline_existing_id_order(baseline: MediaLinkRow[]): number[] {
  return [...baseline].sort((a, b) => a.order - b.order).map((row) => row.id);
}

export function draft_existing_id_order(draft: DraftMediaItem[]): number[] {
  return draft
    .filter((item): item is DraftMediaItem & { id: number } => typeof item.id === 'number')
    .map((item) => item.id);
}

export function has_order_changed(baseline: MediaLinkRow[], draft: DraftMediaItem[]): boolean {
  const baseline_ids = baseline_existing_id_order(baseline);
  const draft_ids = draft_existing_id_order(draft);
  return (
    baseline_ids.length !== draft_ids.length ||
    baseline_ids.some((id, index) => id !== draft_ids[index])
  );
}

export function compute_multimedia_diff(
  baseline: MediaLinkRow[],
  draft: DraftMediaItem[]
): MultimediaDiff {
  const baseline_by_id = new Map(baseline.map((row) => [row.id, row]));
  const draft_existing_ids = new Set(
    draft.filter((item) => typeof item.id === 'number').map((item) => item.id as number)
  );

  const deletes = baseline.filter((row) => !draft_existing_ids.has(row.id)).map((row) => row.id);

  const creates = draft.filter(is_new_draft_item).map((item) => ({
    client_id: item.id as string,
    media_type: item.media_type,
    link: item.link,
    name: item.name,
    lang_id: item.lang_id,
    order: draft.indexOf(item)
  }));

  const updates = draft
    .filter((item): item is DraftMediaItem & { id: number } => typeof item.id === 'number')
    .flatMap((item) => {
      const base = baseline_by_id.get(item.id);
      if (!base) return [];

      const patch: MultimediaDiff['updates'][number] = { id: item.id };
      let changed = false;

      if (base.media_type !== item.media_type) {
        patch.media_type = item.media_type;
        changed = true;
      }
      if (base.link !== item.link) {
        patch.link = item.link;
        changed = true;
      }
      if (base.name !== item.name) {
        patch.name = item.name;
        changed = true;
      }
      if (base.lang_id !== item.lang_id) {
        patch.lang_id = item.lang_id;
        changed = true;
      }

      return changed ? [patch] : [];
    });

  const order_changed = has_order_changed(baseline, draft);
  const order_updates = order_changed
    ? draft
        .map((item, order) => ({ item, order }))
        .filter(({ item }) => typeof item.id === 'number')
        .flatMap(({ item, order }) => {
          const base = baseline_by_id.get(item.id as number);
          if (!base || base.order === order) return [];
          return [{ id: item.id as number, order }];
        })
    : [];

  return { creates, updates, deletes, order_updates };
}

export function is_draft_dirty(baseline: MediaLinkRow[], draft: DraftMediaItem[]): boolean {
  if (baseline.length === 0 && draft.length === 0) return false;

  const diff = compute_multimedia_diff(baseline, draft);
  return (
    diff.creates.length > 0 ||
    diff.updates.length > 0 ||
    diff.deletes.length > 0 ||
    has_order_changed(baseline, draft)
  );
}

export function validate_draft_items(draft: DraftMediaItem[]): boolean {
  return draft.every(
    (item) => item.name.trim().length > 0 && z.string().url().safeParse(item.link).success
  );
}

export function media_tab_counts(rows: MediaLinkRow[] | DraftMediaItem[]) {
  return {
    all: rows.length,
    video: rows.filter((row) => row.media_type === 'video').length,
    audio: rows.filter((row) => row.media_type === 'audio').length,
    pdf: rows.filter((row) => row.media_type === 'pdf').length,
    text: rows.filter((row) => row.media_type === 'text').length
  };
}

export function filter_by_media_tab<T extends { media_type: string }>(
  rows: T[],
  tab: MediaTab
): T[] {
  return tab === 'all' ? rows : rows.filter((row) => row.media_type === tab);
}
