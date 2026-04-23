import { describe, expect, it } from 'vitest';
import { get_project_from_key, get_levels_from_map } from '../../../app/src/state/project_list';
import {
  build_pretty_route_segment,
  get_child_route_items,
  get_pretty_segments_for_path_params,
  get_selected_text_levels_from_path_params,
  normalize_level_name_for_url,
  parse_pretty_route_segment,
  resolve_text_route
} from './text-routes';

describe('text-routes', () => {
  it('normalizes and parses pretty route segments', () => {
    expect(normalize_level_name_for_url('Chapter Name')).toBe('chapter-name');
    // Accent characters should not split URL tokens.
    expect(normalize_level_name_for_url('Bhāga')).toBe('bhaga');
    expect(build_pretty_route_segment('Bhāga', 1)).toBe('bhaga-1');
    expect(build_pretty_route_segment('Kanda', 3)).toBe('kanda-3');
    expect(parse_pretty_route_segment('sarga-12')).toEqual({
      level_slug: 'sarga',
      num: 12
    });
    expect(parse_pretty_route_segment('12')).toBeNull();
  });

  it('builds pretty segments from numeric path params', async () => {
    const map = await get_project_from_key('ramayanam').get_map();
    expect(get_pretty_segments_for_path_params(map, [1, 2])).toEqual(['kanda-1', 'sarga-2']);
    expect(get_pretty_segments_for_path_params(map, [8])).toBeNull();
  });

  it('redirects old numeric routes to the pretty route shape', async () => {
    const resolved = await resolve_text_route('ramayanam', ['1', '2']);
    expect(resolved?.redirect_to).toBe('/ramayanam/kanda-1/sarga-2');
    expect(resolved?.path_params).toEqual([1, 2]);
  });

  it('handles Veda accent-based slugs (Bhāga)', async () => {
    const fromPretty = await resolve_text_route('veda', ['veda-1', 'bhaga-1']);
    expect(fromPretty).not.toBeNull();
    expect(fromPretty?.redirect_to).toBeNull();
    expect(fromPretty?.canonical_path).toBe('/veda/veda-1/bhaga-1');
    expect(fromPretty?.path_params).toEqual([1, 1]);

    const fromNumeric = await resolve_text_route('veda', ['1', '1']);
    expect(fromNumeric?.redirect_to).toBe('/veda/veda-1/bhaga-1');
  });

  it('resolves valid pretty routes and rejects invalid ones', async () => {
    const valid = await resolve_text_route('ramayanam', ['kanda-1', 'sarga-2']);
    expect(valid).not.toBeNull();
    expect(valid?.redirect_to).toBeNull();
    expect(valid?.path_params).toEqual([1, 2]);
    expect(valid?.node.info.type).toBe('shloka');

    const wrong_name = await resolve_text_route('ramayanam', ['chapter-1']);
    expect(wrong_name).toBeNull();

    const out_of_range = await resolve_text_route('ramayanam', ['kanda-99']);
    expect(out_of_range).toBeNull();
  });

  it('handles root and direct-leaf project routes', async () => {
    const root = await resolve_text_route('ramayanam', []);
    expect(root?.node.info.type).toBe('list');
    expect(root?.canonical_path).toBe('/ramayanam');

    const direct_leaf = await resolve_text_route('bhagavadgita', ['chapter-1']);
    expect(direct_leaf?.node.info.type).toBe('shloka');
    expect(direct_leaf?.path_params).toEqual([1]);
  });

  it('builds child link items for intermediate pages', async () => {
    const map = await get_project_from_key('ramayanam').get_map();
    const levels = get_levels_from_map(map);
    const items = get_child_route_items('ramayanam', map, [1], levels);
    expect(items[0]).toMatchObject({
      index: 1,
      href: '/ramayanam/kanda-1/sarga-1',
      is_disabled: false
    });
  });

  it('converts leaf path params into selected_text_levels for translations', () => {
    expect(get_selected_text_levels_from_path_params([1, 2], 3)).toEqual([2, 1]);
    expect(get_selected_text_levels_from_path_params([1], 2)).toEqual([1]);
    expect(get_selected_text_levels_from_path_params([], 1)).toEqual([]);
  });
});
