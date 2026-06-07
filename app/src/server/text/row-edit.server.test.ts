import { describe, expect, it } from 'vitest';
import type { recursive_list_type } from '~/state/data_types';
import {
  buildTextEditRedisKeys,
  buildTextRowsForSave,
  cloneMapWithUpdatedLeafCounts,
  getAffectedTranslationLangIds,
  remapTranslationsForTextRows,
  type ExistingTranslationRow,
  type TextEditorRowInput
} from './row-edit.server';

const rows = (...items: TextEditorRowInput[]) => items;

describe('text_row_edit', () => {
  it('builds zero-based text indexes and one-based shloka numbers', () => {
    expect(
      buildTextRowsForSave(
        rows(
          { source_index: 0, text: 'अ॒ग्निम्', shloka_type: true },
          { source_index: 1, text: 'intro', shloka_type: false },
          { source_index: 2, text: 'ई॑ळे', shloka_type: true }
        )
      )
    ).toEqual([
      { index: 0, shloka_num: 1, text: 'अ॒ग्निम्', text_search: 'अग्निम्' },
      { index: 1, shloka_num: null, text: 'intro', text_search: 'intro' },
      { index: 2, shloka_num: 2, text: 'ई॑ळे', text_search: 'ईळे' }
    ]);
  });

  it('drops translations for deleted text rows and shifts kept rows to their new indexes', () => {
    const translations: ExistingTranslationRow[] = [
      { lang_id: 1, index: 0, text: 'en 0' },
      { lang_id: 1, index: 1, text: 'en 1' },
      { lang_id: 1, index: 2, text: 'en 2' },
      { lang_id: 3, index: 2, text: 'hi 2' }
    ];

    expect(
      remapTranslationsForTextRows(
        rows(
          { source_index: 0, text: 'first', shloka_type: true },
          { source_index: 2, text: 'third', shloka_type: true }
        ),
        translations
      )
    ).toEqual([
      { lang_id: 1, index: 0, text: 'en 0' },
      { lang_id: 1, index: 1, text: 'en 2' },
      { lang_id: 3, index: 1, text: 'hi 2' }
    ]);
  });

  it('carries translations with reordered source rows', () => {
    const translations: ExistingTranslationRow[] = [
      { lang_id: 1, index: 0, text: 'en 0' },
      { lang_id: 1, index: 1, text: 'en 1' },
      { lang_id: 3, index: 0, text: 'hi 0' }
    ];

    expect(
      remapTranslationsForTextRows(
        rows(
          { source_index: 1, text: 'second', shloka_type: true },
          { source_index: 0, text: 'first', shloka_type: true },
          { source_index: null, text: 'new', shloka_type: false }
        ),
        translations
      )
    ).toEqual([
      { lang_id: 1, index: 0, text: 'en 1' },
      { lang_id: 1, index: 1, text: 'en 0' },
      { lang_id: 3, index: 1, text: 'hi 0' }
    ]);
  });

  it('builds text, map, and affected translation cache keys', () => {
    const translations = [
      { lang_id: 1, index: 0, text: 'en' },
      { lang_id: 3, index: 1, text: 'hi' },
      { lang_id: 3, index: 2, text: 'hi again' }
    ];

    expect(
      buildTextEditRedisKeys(42, [1, 2], getAffectedTranslationLangIds(translations)).sort()
    ).toEqual(['project_map:42', 'text_data:42:1/2', 'trans_data:42:1:1/2', 'trans_data:42:3:1/2']);
  });

  it('updates only the selected shloka leaf counts in a cloned map', () => {
    const map: recursive_list_type = {
      name_dev: 'Project',
      info: { type: 'list', list_name: 'Chapter' },
      list: [
        {
          name_dev: 'One',
          info: { type: 'shloka', total: 2, shloka_count: 2, shloka_count_expected: null },
          list: []
        }
      ]
    };

    const updated = cloneMapWithUpdatedLeafCounts(map, [1], { total: 3, shloka_count: 2 });

    expect(updated).not.toBe(map);
    expect(updated.list?.[0]?.info).toEqual({
      type: 'shloka',
      total: 3,
      shloka_count: 2,
      shloka_count_expected: null
    });
    expect(map.list?.[0]?.info).toEqual({
      type: 'shloka',
      total: 2,
      shloka_count: 2,
      shloka_count_expected: null
    });
  });
});
