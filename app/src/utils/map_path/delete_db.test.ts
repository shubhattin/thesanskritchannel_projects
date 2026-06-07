import { describe, expect, it } from 'vitest';
import {
  applyDeletePathCompactionsToPath,
  buildDeletePathCompactions,
  type DeletePathCompaction
} from './delete.server';
import { buildRedisKeysForDeleteInvalidation } from './delete_db.server';
import { mergePathSwapInvalidation } from './swap_db.server';
import type { recursive_list_type } from '~/state/data_types';

const sample_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'List A',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: [
        {
          name_dev: 'Shloka 1',
          info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
          list: []
        },
        {
          name_dev: 'Shloka 2',
          info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
          list: []
        }
      ]
    }
  ]
});

const parent_shift_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'Section 1',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: [
        {
          name_dev: 'Branch 1',
          info: { type: 'list', list_name: 'Prakarana', list_count_expected: null },
          list: [
            {
              name_dev: 'Leaf 1',
              info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
              list: []
            }
          ]
        },
        {
          name_dev: 'Branch 2',
          info: { type: 'list', list_name: 'Prakarana', list_count_expected: null },
          list: [
            {
              name_dev: 'Leaf 2',
              info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
              list: []
            }
          ]
        },
        {
          name_dev: 'Branch 3',
          info: { type: 'list', list_name: 'Prakarana', list_count_expected: null },
          list: [
            {
              name_dev: 'Leaf 3',
              info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
              list: []
            }
          ]
        }
      ]
    }
  ]
});

describe('map_path_delete_db', () => {
  it('invalidates both deleted and shifted cache keys for a middle-sibling delete', () => {
    const compactions = buildDeletePathCompactions(sample_map(), ['1:1']);
    const invalidation = mergePathSwapInvalidation(
      {
        textAndMediaPaths: ['1:1', '1:2'],
        translationPaths: [
          { lang_id: 7, path: '1:1' },
          { lang_id: 7, path: '1:2' }
        ]
      },
      {
        textAndMediaPaths: ['1:1'],
        translationPaths: [{ lang_id: 7, path: '1:1' }]
      }
    );

    expect(compactions).toEqual([
      {
        deleted_path: '1:1',
        remap_steps: [{ from_path: '1:2', to_path: '1:1' }]
      }
    ]);
    expect(buildRedisKeysForDeleteInvalidation(42, invalidation).sort()).toEqual(
      [
        'media_links:42:1/1',
        'media_links:42:1/2',
        'text_data:42:1/1',
        'text_data:42:1/2',
        'trans_data:42:7:1/1',
        'trans_data:42:7:1/2'
      ].sort()
    );
  });

  it('rewrites deep descendants by changing only the shifted segment', () => {
    const compactions = buildDeletePathCompactions(parent_shift_map(), ['1:2']);

    expect(applyDeletePathCompactionsToPath('1:3:1', compactions)).toBe('1:2:1');
    expect(applyDeletePathCompactionsToPath('1:3:1:4', compactions)).toBe('1:2:1:4');
    expect(applyDeletePathCompactionsToPath('1:2:1', compactions)).toBeNull();
  });

  it('applies ordered compactions across multiple deletes without leaving stale paths behind', () => {
    const compactions: DeletePathCompaction[] = [
      {
        deleted_path: '4',
        remap_steps: [{ from_path: '5', to_path: '4' }]
      },
      {
        deleted_path: '2',
        remap_steps: [
          { from_path: '3', to_path: '2' },
          { from_path: '4', to_path: '3' }
        ]
      }
    ];

    expect(applyDeletePathCompactionsToPath('2', compactions)).toBeNull();
    expect(applyDeletePathCompactionsToPath('4', compactions)).toBeNull();
    expect(applyDeletePathCompactionsToPath('3', compactions)).toBe('2');
    expect(applyDeletePathCompactionsToPath('5:9', compactions)).toBe('3:9');
  });
});
