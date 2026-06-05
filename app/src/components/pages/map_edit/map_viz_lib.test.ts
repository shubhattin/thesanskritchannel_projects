import { describe, expect, it } from 'vitest';
import {
  clone_map_with_client_ids,
  default_tree_expanded_paths,
  get_node_at_map_path,
  type BaselineNodeSnapshot
} from './map_edit_lib';
import { build_map_viz_layout, expand_all_map_viz_paths, map_viz_node_kind } from './map_viz_lib';
import type { recursive_list_type } from '~/state/data_types';

const base_map = (): recursive_list_type => ({
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

function setup_working() {
  const snapshots = new Map<string, BaselineNodeSnapshot>();
  const working = clone_map_with_client_ids(base_map(), null, 0, snapshots);
  return { working, snapshots };
}

describe('map_viz_lib', () => {
  it('classifies node kinds for map visualization colors', () => {
    const { working } = setup_working();
    expect(map_viz_node_kind(working)).toBe('list');
    const listChild = get_node_at_map_path(working, [1])!;
    expect(map_viz_node_kind(listChild)).toBe('list');
    const shlokaLeaf = get_node_at_map_path(working, [2])!;
    expect(map_viz_node_kind(shlokaLeaf)).toBe('leaf');
  });

  it('lays out visible nodes and expands on demand', () => {
    const { working } = setup_working();
    const rootOnly = build_map_viz_layout(working, new Set());
    expect(rootOnly.nodes).toHaveLength(1);
    expect(rootOnly.nodes[0]?.name_dev).toBe('Project');

    const defaultExpanded = build_map_viz_layout(working, default_tree_expanded_paths());
    expect(defaultExpanded.nodes).toHaveLength(3);

    const expanded = build_map_viz_layout(working, expand_all_map_viz_paths(working));
    expect(expanded.nodes.length).toBeGreaterThan(1);
    expect(expanded.edges.length).toBeGreaterThan(0);
    const leaf = expanded.nodes.find((n) => n.kind === 'leaf');
    expect(leaf?.lines.some((line) => line.startsWith('Shlokas:'))).toBe(true);
    const listNode = expanded.nodes.find((n) => n.kind === 'list' && !n.isRoot);
    expect(listNode?.lines.some((line) => line.startsWith('Level:'))).toBe(true);
  });
});
