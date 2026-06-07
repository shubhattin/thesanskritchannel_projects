import { describe, expect, it } from 'vitest';
import { dbPathMatchesPrefix } from './path-swap';
import {
  applyDeletePathCompactionsToPath,
  applyDeletedSubtreesToMap,
  buildDeletePathCompactions,
  dbPathToMapPath,
  listDeleteCompactionPrefixes,
  mapPathToDbPath,
  mapsStructurallyEqual,
  minimizeDbPathPrefixes,
  validateDeleteMapProposal,
  validateDeletedPathsInMap,
  remove_node_at_saved_map_path
} from './path-delete.server';
import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';

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
          info: { type: 'shloka', shloka_count: 1, total: 1, shloka_count_expected: null },
          list: []
        },
        {
          name_dev: 'Shloka 2',
          info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
          list: []
        }
      ]
    },
    {
      name_dev: 'Shloka leaf',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    }
  ]
});

const sample_wide_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'Node 1',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    },
    {
      name_dev: 'Node 2',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    },
    {
      name_dev: 'Node 3',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    },
    {
      name_dev: 'Node 4',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    },
    {
      name_dev: 'Node 5',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    }
  ]
});

const sample_parent_delete_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'Section 1',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: [
        {
          name_dev: 'Section 1.1',
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
          name_dev: 'Section 1.2',
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
          name_dev: 'Section 1.3',
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

describe('map_path_delete.server', () => {
  it('converts map paths to DB paths', () => {
    expect(mapPathToDbPath([1, 2])).toBe('1:2');
    expect(dbPathToMapPath('1:2')).toEqual([1, 2]);
  });

  it('minimizes overlapping deleted prefixes', () => {
    expect(minimizeDbPathPrefixes(['1:1', '1:1:1', '2']).sort()).toEqual(['1:1', '2']);
    expect(minimizeDbPathPrefixes(['1', '1:2'])).toEqual(['1']);
  });

  it('rejects unknown paths', () => {
    const map = sample_map();
    expect(validateDeletedPathsInMap(map, [])).toBeNull();
    expect(validateDeletedPathsInMap(map, ['9'])).toMatch(/does not exist/);
  });

  it('matches subtree prefixes on segment boundaries', () => {
    expect(dbPathMatchesPrefix('1:1:1', '1:1')).toBe(true);
    expect(dbPathMatchesPrefix('1:10', '1:1')).toBe(false);
  });

  it('derives map after deleting a leaf', () => {
    const saved = sample_map();
    const derived = applyDeletedSubtreesToMap(saved, ['2']);
    expect(get_node_at_path(derived, [2])).toBeNull();
    expect(get_node_at_path(derived, [1, 1])?.name_dev).toBe('Shloka 1');
    expect(get_node_at_path(derived, [1, 2])?.name_dev).toBe('Shloka 2');
  });

  it('derives map after deleting a parent subtree', () => {
    const saved = sample_map();
    const derived = applyDeletedSubtreesToMap(saved, ['1']);
    expect(get_node_at_path(derived, [1])?.name_dev).toBe('Shloka leaf');
    expect(get_node_at_path(derived, [2])).toBeNull();
  });

  it('derives map after deleting two sibling leaves', () => {
    const saved = sample_map();
    const derived = applyDeletedSubtreesToMap(saved, ['1:1', '1:2']);
    expect(get_node_at_path(derived, [1, 1])).toBeNull();
    expect(get_node_at_path(derived, [1, 2])).toBeNull();
    expect(get_node_at_path(derived, [1])?.info.type).toBe('list');
    expect((get_node_at_path(derived, [1]) as recursive_list_type).list).toEqual([]);
  });

  it('rejects malformed numeric map path segments before splicing', () => {
    const saved = sample_map();
    expect(remove_node_at_saved_map_path(saved, [Number.NaN])).toBeNull();
    expect(remove_node_at_saved_map_path(saved, [1, 0])).toBeNull();
    expect(remove_node_at_saved_map_path(saved, [1, 1.5])).toBeNull();
  });

  it('rejects piggybacked metadata edits in a client map proposal', () => {
    const saved = sample_map();
    const derived = applyDeletedSubtreesToMap(saved, ['2']);
    const tampered = structuredClone(derived) as recursive_list_type;
    const listA = get_node_at_path(tampered, [1])!;
    listA.name_dev = 'Renamed list';

    expect(validateDeleteMapProposal(saved, derived, ['2'])).toBeNull();
    expect(validateDeleteMapProposal(saved, tampered, ['2'])).toMatch(
      /only the requested subtrees removed/
    );
    expect(mapsStructurallyEqual(saved, tampered)).toBe(false);
  });

  it('rejects extra branches removed without declaring deleted_paths', () => {
    const saved = sample_map();
    const derived = applyDeletedSubtreesToMap(saved, ['1:2']);
    const extraDrop = structuredClone(derived) as recursive_list_type;
    extraDrop.list = [extraDrop.list![0]!];

    expect(validateDeleteMapProposal(saved, extraDrop, ['1:2'])).toMatch(
      /only the requested subtrees removed/
    );
  });

  it('rejects undeclared deletions when deleted_paths omit a removed branch', () => {
    const saved = sample_map();
    const derived = applyDeletedSubtreesToMap(saved, ['1']);
    expect(validateDeleteMapProposal(saved, derived, ['1:1'])).toMatch(
      /only the requested subtrees removed/
    );
  });

  it('builds compaction steps for deleting a middle sibling leaf', () => {
    const compactions = buildDeletePathCompactions(sample_map(), ['1:1']);

    expect(compactions).toEqual([
      {
        deleted_path: '1:1',
        remap_steps: [{ from_path: '1:2', to_path: '1:1' }]
      }
    ]);
    expect(applyDeletePathCompactionsToPath('1:1', compactions)).toBeNull();
    expect(applyDeletePathCompactionsToPath('1:2', compactions)).toBe('1:1');
    expect(listDeleteCompactionPrefixes(compactions).sort()).toEqual(['1:1', '1:2']);
  });

  it('shifts later siblings after deleting a non-last parent subtree', () => {
    const saved = sample_parent_delete_map();
    const compactions = buildDeletePathCompactions(saved, ['1:2']);
    const derived = applyDeletedSubtreesToMap(saved, ['1:2']);

    expect(get_node_at_path(derived, [1, 2])?.name_dev).toBe('Section 1.3');
    expect(compactions).toEqual([
      {
        deleted_path: '1:2',
        remap_steps: [{ from_path: '1:3', to_path: '1:2' }]
      }
    ]);
    expect(applyDeletePathCompactionsToPath('1:3:1', compactions)).toBe('1:2:1');
  });

  it('compacts multiple same-depth deletes by more than one slot', () => {
    const compactions = buildDeletePathCompactions(sample_wide_map(), ['2', '4']);
    const derived = applyDeletedSubtreesToMap(sample_wide_map(), ['2', '4']);

    expect(derived.list?.map((node) => node.name_dev)).toEqual(['Node 1', 'Node 3', 'Node 5']);
    expect(compactions).toEqual([
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
    ]);
    expect(applyDeletePathCompactionsToPath('5', compactions)).toBe('3');
    expect(applyDeletePathCompactionsToPath('3', compactions)).toBe('2');
  });
});
