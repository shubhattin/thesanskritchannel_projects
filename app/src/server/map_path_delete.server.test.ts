import { describe, expect, it } from 'vitest';
import { dbPathMatchesPrefix } from './map_path_swap';
import {
  applyDeletedSubtreesToMap,
  dbPathToMapPath,
  mapPathToDbPath,
  mapsStructurallyEqual,
  minimizeDbPathPrefixes,
  validateDeleteMapProposal,
  validateDeletedPathsInMap
} from './map_path_delete.server';
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
});
