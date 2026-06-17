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
export type MediaLangTab = 'all' | number;

export type MediaLangTabItem =
  | { id: 'all'; label: string; count: number }
  | { id: number; label: string; count: number };

export type MediaTypeTabItem = { id: MediaTab; label: string; count: number };

const MEDIA_TYPE_TAB_LABELS: Record<media_list_type, string> = {
  video: 'Videos',
  audio: 'Audio',
  pdf: 'PDFs',
  text: 'Text'
};

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

  const order_updates = needs_order_reconcile(baseline, draft)
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

export function needs_order_reconcile(baseline: MediaLinkRow[], draft: DraftMediaItem[]): boolean {
  const diff_deletes = baseline.filter((row) => !draft.some((item) => item.id === row.id));
  const diff_creates = draft.filter(is_new_draft_item);
  return has_order_changed(baseline, draft) || diff_deletes.length > 0 || diff_creates.length > 0;
}

export function is_draft_dirty(baseline: MediaLinkRow[], draft: DraftMediaItem[]): boolean {
  if (baseline.length === 0 && draft.length === 0) return false;

  const diff = compute_multimedia_diff(baseline, draft);
  return (
    diff.creates.length > 0 ||
    diff.updates.length > 0 ||
    diff.deletes.length > 0 ||
    needs_order_reconcile(baseline, draft)
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

export function media_type_tabs_list(
  counts: ReturnType<typeof media_tab_counts>
): MediaTypeTabItem[] {
  return [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'video', label: MEDIA_TYPE_TAB_LABELS.video, count: counts.video },
    { id: 'audio', label: MEDIA_TYPE_TAB_LABELS.audio, count: counts.audio },
    { id: 'pdf', label: MEDIA_TYPE_TAB_LABELS.pdf, count: counts.pdf },
    { id: 'text', label: MEDIA_TYPE_TAB_LABELS.text, count: counts.text }
  ].filter((tab) => tab.count > 0);
}

export function filter_by_media_tab<T extends { media_type: string }>(
  rows: T[],
  tab: MediaTab
): T[] {
  return tab === 'all' ? rows : rows.filter((row) => row.media_type === tab);
}

export function media_lang_tabs_list<T extends { lang_id: number | null }>(
  rows: T[],
  get_lang_name: (lang_id: number) => string | null
): MediaLangTabItem[] {
  const by_lang = new Map<number, number>();
  for (const row of rows) {
    if (row.lang_id !== null) {
      by_lang.set(row.lang_id, (by_lang.get(row.lang_id) ?? 0) + 1);
    }
  }
  if (by_lang.size <= 1) return [];

  const lang_tabs = [...by_lang.entries()]
    .map(([id, count]) => ({
      id,
      label: get_lang_name(id) ?? `Lang ${id}`,
      count
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [{ id: 'all', label: 'All', count: rows.length }, ...lang_tabs];
}

export function filter_by_media_lang<T extends { lang_id: number | null }>(
  rows: T[],
  lang_tab: MediaLangTab
): T[] {
  return lang_tab === 'all' ? rows : rows.filter((row) => row.lang_id === lang_tab);
}
