import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import type { recursive_list_type } from '~/state/data_types';
import {
  collect_db_paths_from_map,
  sort_db_paths_by_depth,
  validate_explicit_to_add_paths
} from './project_map_sync.server';

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
  it('collects all db paths from a nested map', () => {
    expect(sort_db_paths_by_depth(collect_db_paths_from_map(base_map()))).toEqual(['1', '1:1']);
  });

  it('accepts metadata save with empty to_add_paths when only the project root type changes', () => {
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

    expect(
      validate_explicit_to_add_paths(
        collect_db_paths_from_map(shlokaRoot),
        collect_db_paths_from_map(listRoot),
        []
      )
    ).toEqual([]);
    expect(
      validate_explicit_to_add_paths(
        collect_db_paths_from_map(listRoot),
        collect_db_paths_from_map(shlokaRoot),
        []
      )
    ).toEqual([]);
  });

  it('accepts exact to_add_paths coverage and returns depth-sorted paths', () => {
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

    expect(
      validate_explicit_to_add_paths(
        collect_db_paths_from_map(previousMap),
        collect_db_paths_from_map(nextMap),
        ['1:2:1', '1:2']
      )
    ).toEqual(['1:2', '1:2:1']);
  });

  it('rejects when to_add_paths omits a newly added descendant path', () => {
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
        collect_db_paths_from_map(previousMap),
        collect_db_paths_from_map(nextMap),
        ['1:2']
      )
    ).toThrowError(
      new TRPCError({
        code: 'BAD_REQUEST',
        message: 'to_add_paths must exactly match newly added map paths (missing: 1:2:1)'
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
        collect_db_paths_from_map(previousMap),
        collect_db_paths_from_map(nextMap),
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
