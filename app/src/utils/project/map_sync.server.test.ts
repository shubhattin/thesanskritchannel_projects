import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import type { recursive_list_type } from '~/state/data_types';
import {
  collect_shloka_db_paths_from_map,
  diff_shloka_db_paths,
  sort_db_paths_by_depth,
  validate_explicit_to_add_paths
} from './map_sync.server';

const base_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'A',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: [
        {
          name_dev: 'A1',
          info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
          list: []
        }
      ]
    }
  ]
});

describe('project_map_sync.server', () => {
  it('collects only shloka db paths from a nested map', () => {
    expect(sort_db_paths_by_depth(collect_shloka_db_paths_from_map(base_map()))).toEqual(['1:1']);
  });

  it('includes the project root path for an empty shloka map', () => {
    const shlokaRoot: recursive_list_type = {
      name_dev: 'Project',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    };

    expect(sort_db_paths_by_depth(collect_shloka_db_paths_from_map(shlokaRoot))).toEqual(['']);
  });

  it('accepts empty to_add_paths when only the project root type changes', () => {
    const shlokaRoot: recursive_list_type = {
      name_dev: 'Project',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    };
    const listRoot: recursive_list_type = {
      name_dev: 'Project',
      info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
      list: []
    };

    expect(() =>
      validate_explicit_to_add_paths(
        collect_shloka_db_paths_from_map(shlokaRoot),
        collect_shloka_db_paths_from_map(listRoot),
        []
      )
    ).not.toThrow();
    expect(() =>
      validate_explicit_to_add_paths(
        collect_shloka_db_paths_from_map(listRoot),
        collect_shloka_db_paths_from_map(shlokaRoot),
        []
      )
    ).not.toThrow();
  });

  it('diffs shloka paths when a childless list converts to shloka', () => {
    const previousMap = base_map();
    previousMap.list![0]!.list![0]!.info = {
      type: 'list',
      list_name: 'Section',
      list_count_expected: null
    };
    const nextMap = base_map();
    nextMap.list![0]!.list![0]!.info = {
      type: 'shloka',
      shloka_count: 0,
      total: 0,
      shloka_count_expected: null
    };

    expect(diff_shloka_db_paths(previousMap, nextMap)).toEqual({
      toInsert: ['1:1'],
      toRemove: []
    });
    expect(() =>
      validate_explicit_to_add_paths(
        collect_shloka_db_paths_from_map(previousMap),
        collect_shloka_db_paths_from_map(nextMap),
        []
      )
    ).not.toThrow();
  });

  it('diffs shloka paths when an empty shloka converts back to list', () => {
    const previousMap = base_map();
    const shlokaLeaf = previousMap.list![0]!.list![0]!;
    shlokaLeaf.info = {
      type: 'shloka',
      shloka_count: 0,
      total: 0,
      shloka_count_expected: null
    };
    const nextMap = base_map();
    nextMap.list![0]!.list![0]!.info = {
      type: 'list',
      list_name: 'Section',
      list_count_expected: null
    };

    expect(diff_shloka_db_paths(previousMap, nextMap)).toEqual({
      toInsert: [],
      toRemove: ['1:1']
    });
  });

  it('accepts the root db path when it is explicitly new', () => {
    const shlokaRoot: recursive_list_type = {
      name_dev: 'Project',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    };

    expect(() =>
      validate_explicit_to_add_paths(new Set(), collect_shloka_db_paths_from_map(shlokaRoot), [''])
    ).not.toThrow();
  });

  it('accepts declared shloka paths that are newly required', () => {
    const previousMap = base_map();
    const nextMap = base_map();
    nextMap.list![0]!.list!.push({
      name_dev: 'A2',
      info: { type: 'list', list_name: 'Prakarana', list_count_expected: null },
      list: [
        {
          name_dev: 'A2.1',
          info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
          list: []
        }
      ]
    });

    expect(() =>
      validate_explicit_to_add_paths(
        collect_shloka_db_paths_from_map(previousMap),
        collect_shloka_db_paths_from_map(nextMap),
        ['1:2:1']
      )
    ).not.toThrow();
    expect(diff_shloka_db_paths(previousMap, nextMap)).toEqual({
      toInsert: ['1:2:1'],
      toRemove: []
    });
  });

  it('rejects when to_add_paths declares a list-only path', () => {
    const previousMap = base_map();
    const nextMap = base_map();
    nextMap.list![0]!.list!.push({
      name_dev: 'A2',
      info: { type: 'list', list_name: 'Prakarana', list_count_expected: null },
      list: [
        {
          name_dev: 'A2.1',
          info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
          list: []
        }
      ]
    });

    expect(() =>
      validate_explicit_to_add_paths(
        collect_shloka_db_paths_from_map(previousMap),
        collect_shloka_db_paths_from_map(nextMap),
        ['1:2']
      )
    ).toThrowError(
      new TRPCError({
        code: 'BAD_REQUEST',
        message: 'to_add_paths entry "1:2" is not a shloka path in the saved map'
      })
    );
  });

  it('rejects duplicate to_add_paths entries', () => {
    const previousMap = base_map();
    const nextMap = base_map();
    nextMap.list![0]!.list!.push({
      name_dev: 'A2',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    });

    expect(() =>
      validate_explicit_to_add_paths(
        collect_shloka_db_paths_from_map(previousMap),
        collect_shloka_db_paths_from_map(nextMap),
        ['1:2', '1:2']
      )
    ).toThrowError(
      new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Duplicate paths are not allowed in to_add_paths'
      })
    );
  });
});
