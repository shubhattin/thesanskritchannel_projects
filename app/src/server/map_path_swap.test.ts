import { describe, expect, it } from 'vitest';
import {
  applyMetadataEditsToMap,
  applySwapEditsToMap,
  buildPathSwapSteps,
  buildAdjacentSwapEdits,
  dbPathToPathParams,
  isEditableDescendantPath,
  mapPathToDbPath,
  toTempDbPath,
  validateDbPath,
  validateOrderRootPath,
  validateSwapEdits,
  validateSwapEditsRootScope,
  validateSwapPair
} from './map_path_swap';
import type { recursive_list_type } from '~/state/data_types';

const sampleMap = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'A',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: [
        {
          name_dev: 'A1',
          info: { type: 'shloka', shloka_count: 1, total: 1, shloka_count_expected: null },
          list: []
        },
        {
          name_dev: 'A2',
          info: { type: 'shloka', shloka_count: 1, total: 1, shloka_count_expected: null },
          list: []
        }
      ]
    },
    {
      name_dev: 'B',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: []
    },
    {
      name_dev: 'C',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: []
    }
  ]
});

describe('map_path_swap', () => {
  it('validates db path segments', () => {
    expect(validateDbPath('1:2:3')).toBeNull();
    expect(validateDbPath('')).not.toBeNull();
    expect(validateDbPath('1:0')).not.toBeNull();
    expect(validateDbPath('1:2_temp')).not.toBeNull();
  });

  it('requires sibling paths at same depth', () => {
    expect(validateSwapPair('1:2', '1:5')).toBeNull();
    expect(validateSwapPair('1:2', '1:2')).not.toBeNull();
    expect(validateSwapPair('1:2', '2:2')).not.toBeNull();
    expect(validateSwapPair('1:2', '1:2:3')).not.toBeNull();
  });

  it('validates edit list', () => {
    expect(
      validateSwapEdits([{ swap_paths: ['2:1', '2:3'] }, { swap_paths: ['2:2', '2:4'] }])
    ).toBeNull();
  });

  it('rejects malformed swap entries', () => {
    expect(validateSwapEdits([{ swap_paths: ['2:1', '2:3', '2:4'] as any }] as any)).toBe(
      'Swap 1: swap_paths must be a tuple of two paths'
    );
  });

  it('builds temp paths', () => {
    expect(toTempDbPath('1:2')).toBe('1:2_temp');
  });

  it('builds ordered single-stage swap steps', () => {
    expect(buildPathSwapSteps('1', '2')).toEqual([
      { from_path: '1', to_path: '2_temp' },
      { from_path: '2', to_path: '1' },
      { from_path: '2_temp', to_path: '2' }
    ]);
  });

  it('rejects invalid db paths when building cache params', () => {
    expect(() => dbPathToPathParams('1:bad')).toThrow('Invalid DB path "1:bad"');
  });

  it('formats map paths for db usage', () => {
    expect(mapPathToDbPath([1, 2, 3])).toBe('1:2:3');
    expect(mapPathToDbPath([])).toBe('');
  });

  it('restricts editable paths to deeper descendants of the chosen root', () => {
    expect(isEditableDescendantPath('1:1:2', [1, 1])).toBe(true);
    expect(isEditableDescendantPath('1:1', [1, 1])).toBe(false);
    expect(isEditableDescendantPath('1:1:2:1', [1, 1])).toBe(false);
    expect(isEditableDescendantPath('1:2:1', [1, 1])).toBe(false);
    expect(isEditableDescendantPath('2', [])).toBe(true);
    expect(isEditableDescendantPath('2:1', [])).toBe(false);
  });

  it('rejects swap edits outside the chosen root scope', () => {
    expect(
      validateSwapEditsRootScope([{ swap_paths: ['1:1:2', '1:1:3'] }], [1, 1])
    ).toBeNull();
    expect(
      validateSwapEditsRootScope([{ swap_paths: ['1:1', '1:1:2'] }], [1, 1])
    ).toBe('Swap 1: Path A must stay under root /1/1');
  });

  it('expands one drag move into adjacent swaps', () => {
    expect(buildAdjacentSwapEdits([], 0, 2)).toEqual([
      { swap_paths: ['1', '2'] },
      { swap_paths: ['2', '3'] }
    ]);
    expect(buildAdjacentSwapEdits([1], 2, 0)).toEqual([
      { swap_paths: ['1:3', '1:2'] },
      { swap_paths: ['1:2', '1:1'] }
    ]);
  });

  it('applies swap edits to the map in the same order as the DB path swaps', () => {
    const reordered = applySwapEditsToMap(sampleMap(), buildAdjacentSwapEdits([], 0, 2));
    expect(reordered.list?.map((node) => node.name_dev)).toEqual(['B', 'C', 'A']);
    expect(reordered.list?.[2]?.list?.map((node) => node.name_dev)).toEqual(['A1', 'A2']);
  });

  it('applies metadata edits without allowing structure changes', () => {
    const current = sampleMap();
    const proposed = sampleMap();
    proposed.name_dev = 'Project 2';
    proposed.list![0]!.name_dev = 'A edited';
    proposed.list![0]!.info = {
      type: 'list',
      list_name: 'Adhyaya',
      list_count_expected: 99
    };
    const merged = applyMetadataEditsToMap(current, proposed);
    expect(merged.name_dev).toBe('Project 2');
    expect(merged.list?.[0]?.name_dev).toBe('A edited');
    expect(merged.list?.[0]?.info).toEqual({
      type: 'list',
      list_name: 'Adhyaya',
      list_count_expected: 99
    });
    expect(merged.list?.[0]?.list?.map((node) => node.name_dev)).toEqual(['A1', 'A2']);
  });

  it('preserves derived shloka counters during metadata-only saves', () => {
    const current = sampleMap();
    const proposed = sampleMap();
    proposed.list![0]!.list![0]!.name_dev = 'A1 renamed';
    proposed.list![0]!.list![0]!.info = {
      type: 'shloka',
      shloka_count: 999,
      total: 999,
      shloka_count_expected: 999
    };
    const merged = applyMetadataEditsToMap(current, proposed);
    expect(merged.list?.[0]?.list?.[0]?.name_dev).toBe('A1 renamed');
    expect(merged.list?.[0]?.list?.[0]?.info).toEqual(current.list?.[0]?.list?.[0]?.info);
  });

  it('rejects metadata saves that reshape the tree', () => {
    const current = sampleMap();
    const proposed = sampleMap();
    proposed.list = [...(proposed.list ?? [])].reverse();
    expect(() => applyMetadataEditsToMap(current, proposed)).toThrow('Map structure changed');
  });

  it('rejects swapped same-shaped siblings during metadata-only saves', () => {
    const current: recursive_list_type = {
      name_dev: 'Project',
      info: { type: 'list', list_name: 'Root', list_count_expected: null },
      list: [
        {
          name_dev: 'Alpha',
          info: { type: 'list', list_name: 'Section', list_count_expected: null },
          list: []
        },
        {
          name_dev: 'Beta',
          info: { type: 'list', list_name: 'Section', list_count_expected: null },
          list: []
        }
      ]
    };
    const proposed: recursive_list_type = {
      ...current,
      list: [...(current.list ?? [])].reverse()
    };
    expect(() => applyMetadataEditsToMap(current, proposed)).toThrow(
      'Ambiguous sibling identity changed during metadata save'
    );
  });

  it('validates that the chosen reorder root exists and can be reordered', () => {
    expect(validateOrderRootPath(sampleMap(), [])).toBeNull();
    expect(validateOrderRootPath(sampleMap(), [1])).toBeNull();
    expect(validateOrderRootPath(sampleMap(), [1, 1])).toContain('must point to a list node');
    expect(validateOrderRootPath(sampleMap(), [9])).toContain('was not found');
  });
});
