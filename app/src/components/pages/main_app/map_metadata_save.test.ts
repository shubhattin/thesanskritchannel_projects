import { describe, expect, it } from 'vitest';
import type { recursive_list_type } from '~/state/data_types';
import {
  apply_map_metadata_patch,
  get_map_metadata_type_convert_target,
  validate_map_metadata_patch
} from './map_metadata_patch';

const sample_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'तैत्तिरीयक',
      info: { type: 'list', list_name: 'Section', list_count_expected: null },
      list: []
    },
    {
      name_dev: 'Shloka leaf',
      info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
      list: []
    }
  ]
});

describe('map_metadata_save type conversion', () => {
  it('detects childless list as convert-to-shloka target', () => {
    const map = sample_map();
    expect(get_map_metadata_type_convert_target(map.list![0]!)).toBe('to_shloka');
    expect(get_map_metadata_type_convert_target(map.list![1]!)).toBe('to_list');
  });

  it('applies list to shloka conversion while preserving custom name_dev', () => {
    const map = sample_map();
    const next = apply_map_metadata_patch(map, { kind: 'convert_to_shloka', path: [1] });
    expect(next.list?.[0]?.info.type).toBe('shloka');
    expect(next.list?.[0]?.name_dev).toBe('तैत्तिरीयक');
  });

  it('rejects shloka conversion when text lines exist', () => {
    const map = sample_map();
    map.list![1]!.info = { type: 'shloka', shloka_count: 1, total: 2, shloka_count_expected: null };
    expect(validate_map_metadata_patch(map, { kind: 'convert_to_list', path: [2] })).toContain(
      'empty shloka'
    );
  });
});
