import { describe, expect, it } from 'vitest';
import {
  baseline_to_draft,
  compute_multimedia_diff,
  create_empty_draft_item,
  filter_by_media_lang,
  filter_by_media_tab,
  is_draft_dirty,
  media_lang_tabs_list,
  media_type_tabs_list,
  move_draft_item,
  needs_order_reconcile,
  type DraftMediaItem,
  type MediaLinkRow
} from './multimedia_lib';

const row = (id: number, order: number, overrides: Partial<MediaLinkRow> = {}): MediaLinkRow => ({
  id,
  lang_id: 1,
  media_type: 'video',
  link: `https://example.com/${id}`,
  name: `Item ${id}`,
  order,
  ...overrides
});

const draft_from_rows = (rows: MediaLinkRow[]): DraftMediaItem[] => baseline_to_draft(rows);

describe('multimedia_lib diff', () => {
  it('is clean when draft matches baseline even with non-contiguous stored orders', () => {
    const baseline = [row(1, 5), row(2, 10), row(3, 15)];
    const draft = draft_from_rows(baseline);
    expect(is_draft_dirty(baseline, draft)).toBe(false);
    expect(compute_multimedia_diff(baseline, draft).order_updates).toEqual([]);
  });

  it('detects delete from the middle and shifts trailing order values', () => {
    const baseline = [row(1, 0), row(2, 1), row(3, 2)];
    const draft = draft_from_rows([row(1, 0), row(3, 2)]);
    const diff = compute_multimedia_diff(baseline, draft);

    expect(diff.deletes).toEqual([2]);
    expect(diff.order_updates).toEqual([{ id: 3, order: 1 }]);
    expect(is_draft_dirty(baseline, draft)).toBe(true);
  });

  it('detects pure reorder without field edits', () => {
    const baseline = [row(1, 0), row(2, 1), row(3, 2)];
    const draft = draft_from_rows([row(3, 2), row(1, 0), row(2, 1)]);
    const diff = compute_multimedia_diff(baseline, draft);

    expect(diff.deletes).toEqual([]);
    expect(diff.updates).toEqual([]);
    expect(diff.order_updates).toEqual([
      { id: 3, order: 0 },
      { id: 1, order: 1 },
      { id: 2, order: 2 }
    ]);
  });

  it('shifts trailing orders when inserting a new item in the middle', () => {
    const baseline = [row(1, 0), row(2, 1)];
    const new_item = { ...create_empty_draft_item(), name: 'New', link: 'https://example.com/new' };
    const draft: DraftMediaItem[] = [
      baseline_to_draft([row(1, 0)])[0],
      new_item,
      baseline_to_draft([row(2, 1)])[0]
    ];
    const diff = compute_multimedia_diff(baseline, draft);

    expect(diff.creates).toHaveLength(1);
    expect(diff.creates[0]?.order).toBe(1);
    expect(diff.order_updates).toEqual([{ id: 2, order: 2 }]);
    expect(needs_order_reconcile(baseline, draft)).toBe(true);
  });

  it('appends a create at the end without reordering existing rows', () => {
    const baseline = [row(1, 0), row(2, 1)];
    const new_item = {
      ...create_empty_draft_item(),
      name: 'Tail',
      link: 'https://example.com/tail'
    };
    const draft = [...draft_from_rows(baseline), new_item];
    const diff = compute_multimedia_diff(baseline, draft);

    expect(diff.creates).toHaveLength(1);
    expect(diff.creates[0]?.order).toBe(2);
    expect(diff.order_updates).toEqual([]);
  });

  it('combines delete, reorder, and field update', () => {
    const baseline = [row(1, 0), row(2, 1), row(3, 2)];
    const moved = move_draft_item(draft_from_rows(baseline), 2, 0);
    const draft = moved
      .filter((item) => item.id !== 2)
      .map((item) => (item.id === 3 ? { ...item, name: 'Renamed' } : item));
    const diff = compute_multimedia_diff(baseline, draft);

    expect(diff.deletes).toEqual([2]);
    expect(diff.updates).toEqual([{ id: 3, name: 'Renamed' }]);
    expect(diff.order_updates).toEqual([
      { id: 3, order: 0 },
      { id: 1, order: 1 }
    ]);
  });
});

describe('multimedia_lib filters', () => {
  const rows = [
    row(1, 0, { media_type: 'video', lang_id: 1 }),
    row(2, 1, { media_type: 'audio', lang_id: 2 }),
    row(3, 2, { media_type: 'video', lang_id: 2 })
  ];

  it('filters by media tab and language tab', () => {
    const videos = filter_by_media_tab(rows, 'video');
    expect(filter_by_media_lang(videos, 2)).toHaveLength(1);
    expect(filter_by_media_lang(videos, 2)[0]?.id).toBe(3);
  });

  it('shows language tabs only when multiple languages exist', () => {
    expect(media_lang_tabs_list(rows, (id) => (id === 1 ? 'English' : 'Hindi'))).toEqual([
      { id: 'all', label: 'All', count: 3 },
      { id: 1, label: 'English', count: 1 },
      { id: 2, label: 'Hindi', count: 2 }
    ]);
    expect(media_lang_tabs_list([row(1, 0)], () => 'English')).toEqual([]);
  });

  it('labels text media type as Text in type tabs', () => {
    const tabs = media_type_tabs_list({
      all: 2,
      video: 1,
      audio: 0,
      pdf: 0,
      text: 1
    });
    expect(tabs.find((tab) => tab.id === 'text')?.label).toBe('Text');
  });
});
