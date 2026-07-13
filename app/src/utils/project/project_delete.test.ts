import { describe, expect, it } from 'vitest';
import type { recursive_list_type } from '~/state/data_types';
import {
  can_auto_clear_root_project_paths,
  finalize_project_delete_resource_counts
} from './project_delete';

const empty_shloka_root = (): recursive_list_type => ({
  name_dev: 'मूलप्रकल्पः',
  info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
  list: []
});

const list_root = (): recursive_list_type => ({
  name_dev: 'मूलप्रकल्पः',
  info: { type: 'list', list_name: 'Level', list_count_expected: null },
  list: []
});

const shloka_with_text = (): recursive_list_type => ({
  name_dev: 'मूलप्रकल्पः',
  info: { type: 'shloka', shloka_count: 1, total: 2, shloka_count_expected: null },
  list: []
});

describe('project delete empty shloka root exception', () => {
  it('allows auto-clear when root is empty childless shloka with no content rows', () => {
    expect(can_auto_clear_root_project_paths(empty_shloka_root(), 0, 0, 0)).toBe(true);
  });

  it('rejects auto-clear for list roots', () => {
    expect(can_auto_clear_root_project_paths(list_root(), 0, 0, 0)).toBe(false);
  });

  it('rejects auto-clear when map reports text lines', () => {
    expect(can_auto_clear_root_project_paths(shloka_with_text(), 0, 0, 0)).toBe(false);
  });

  it('rejects auto-clear when DB still has texts/translations/media', () => {
    expect(can_auto_clear_root_project_paths(empty_shloka_root(), 1, 0, 0)).toBe(false);
    expect(can_auto_clear_root_project_paths(empty_shloka_root(), 0, 2, 0)).toBe(false);
    expect(can_auto_clear_root_project_paths(empty_shloka_root(), 0, 0, 1)).toBe(false);
  });

  it('hides root project_paths from blocking total for empty shloka roots', () => {
    const counts = finalize_project_delete_resource_counts({
      map: empty_shloka_root(),
      texts: 0,
      translations: 0,
      media_attachment: 0,
      project_paths: 1,
      user_project_join: 0,
      user_project_language_join: 0
    });

    expect(counts.auto_clear_project_paths).toBe(true);
    expect(counts.project_paths).toBe(0);
    expect(counts.total).toBe(0);
  });

  it('still blocks when user assignments exist on an empty shloka root', () => {
    const counts = finalize_project_delete_resource_counts({
      map: empty_shloka_root(),
      texts: 0,
      translations: 0,
      media_attachment: 0,
      project_paths: 1,
      user_project_join: 1,
      user_project_language_join: 0
    });

    expect(counts.auto_clear_project_paths).toBe(true);
    expect(counts.project_paths).toBe(0);
    expect(counts.user_project_join).toBe(1);
    expect(counts.total).toBe(1);
  });

  it('keeps project_paths blocking for non-empty or non-shloka roots', () => {
    const with_text = finalize_project_delete_resource_counts({
      map: shloka_with_text(),
      texts: 2,
      translations: 0,
      media_attachment: 0,
      project_paths: 1,
      user_project_join: 0,
      user_project_language_join: 0
    });
    expect(with_text.auto_clear_project_paths).toBe(false);
    expect(with_text.project_paths).toBe(1);
    expect(with_text.total).toBe(3);

    const list = finalize_project_delete_resource_counts({
      map: list_root(),
      texts: 0,
      translations: 0,
      media_attachment: 0,
      project_paths: 1,
      user_project_join: 0,
      user_project_language_join: 0
    });
    expect(list.auto_clear_project_paths).toBe(false);
    expect(list.project_paths).toBe(1);
    expect(list.total).toBe(1);
  });
});
