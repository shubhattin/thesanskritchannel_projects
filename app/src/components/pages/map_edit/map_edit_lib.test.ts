import { describe, expect, it } from 'vitest';
import {
  apply_map_edit_list_defaults,
  build_delete_review_state,
  clone_map_with_client_ids,
  clone_working_map,
  collect_deleted_paths_from_entry,
  compute_map_edit_diff,
  create_map_edit_child,
  expand_terminal_deleted_paths,
  get_node_at_map_path,
  remove_node_at_path,
  type BaselineNodeSnapshot,
  type MapNodeWithClientId
} from './map_edit_lib';
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

describe('map_edit_lib normal-mode structure edits', () => {
  it('creates shloka and list children with expected defaults', () => {
    const shloka = create_map_edit_child('shloka');
    expect(shloka.name_dev).toBe('नवश्लोकानि');
    expect(shloka.info).toEqual({
      type: 'shloka',
      shloka_count: 0,
      total: 0,
      shloka_count_expected: null
    });
    expect(shloka.list).toEqual([]);

    const list = create_map_edit_child('list');
    expect(list.name_dev).toBe('नवसूची');
    expect(list.info).toEqual({
      type: 'list',
      list_name: 'Level Name',
      list_count_expected: null
    });
    expect(list.list).toEqual([]);
  });

  it('detects appended children as add_child changes', () => {
    const { working, snapshots } = setup_working();
    const listNode = get_node_at_map_path(working, [1])!;
    listNode.list = [...(listNode.list ?? []), create_map_edit_child('shloka')];

    const diff = compute_map_edit_diff(working, snapshots);
    expect(diff.dirty).toBe(true);
    expect(diff.rows.some((r) => r.kind === 'add_child')).toBe(true);
    expect(diff.rows.some((r) => r.summary === 'Added shloka child at position 2')).toBe(true);
  });

  it('preserves name_dev when applying list defaults on the map root', () => {
    const { working } = setup_working();
    const rootName = working.name_dev;
    apply_map_edit_list_defaults(working, { preserve_name_dev: true });
    expect(working.name_dev).toBe(rootName);
    expect(working.info.type).toBe('list');
    expect(working.info.type === 'list' && working.info.list_name).toBe('Level Name');
  });

  it('does not emit type_change for unsaved added nodes', () => {
    const { working, snapshots } = setup_working();
    const listNode = get_node_at_map_path(working, [1])!;
    const added = create_map_edit_child('shloka');
    listNode.list = [...(listNode.list ?? []), added];
    apply_map_edit_list_defaults(added);

    const diff = compute_map_edit_diff(working, snapshots);
    expect(diff.rows.filter((r) => r.kind === 'type_change')).toHaveLength(0);
    expect(diff.rows.some((r) => r.kind === 'add_child' && r.summary.includes('list'))).toBe(true);
  });

  it('detects childless shloka to list conversion', () => {
    const { working, snapshots } = setup_working();
    const node = get_node_at_map_path(working, [2]) as MapNodeWithClientId;
    node.info = { type: 'list', list_name: 'Section', list_count_expected: null };
    node.list = [];

    const diff = compute_map_edit_diff(working, snapshots);
    expect(diff.rows.some((r) => r.kind === 'type_change')).toBe(true);
    expect(diff.rows.some((r) => r.summary === 'Converted Shloka → List')).toBe(true);
  });

  it('detects childless list to shloka conversion', () => {
    const { working, snapshots } = setup_working();
    const node = get_node_at_map_path(working, [1]) as MapNodeWithClientId;
    node.info = { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null };
    node.list = [];

    const diff = compute_map_edit_diff(working, snapshots);
    expect(diff.rows.some((r) => r.summary === 'Converted List → Shloka')).toBe(true);
  });
});

describe('map_edit_lib delete mode', () => {
  it('cannot delete project root', () => {
    const { working } = setup_working();
    expect(remove_node_at_path(working, [])).toBe(false);
  });

  it('deleting a leaf removes only that path', () => {
    const { working } = setup_working();
    const entry = clone_working_map(working);
    expect(remove_node_at_path(working, [2])).toBe(true);
    expect(collect_deleted_paths_from_entry(entry, working)).toEqual([[2]]);
    expect(expand_terminal_deleted_paths(entry, [[2]])).toEqual([[2]]);
  });

  it('deleting a parent removes descendants from review roots but expands terminal paths', () => {
    const { working } = setup_working();
    const entry = clone_working_map(working);
    expect(remove_node_at_path(working, [1])).toBe(true);
    expect(collect_deleted_paths_from_entry(entry, working)).toEqual([[1]]);
    expect(expand_terminal_deleted_paths(entry, [[1]])).toEqual([[1, 1]]);
  });

  it('overlapping deletes do not double-count terminal paths', () => {
    const { working } = setup_working();
    const entry = clone_working_map(working);
    remove_node_at_path(working, [1]);
    const review = build_delete_review_state(entry, working);
    expect(review.terminalPaths).toEqual([[1, 1]]);
    expect(review.rows).toHaveLength(1);
  });

  it('nested terminal expansion includes childless list nodes', () => {
    const { working } = setup_working();
    const entry = clone_working_map(working);
    const parent = get_node_at_map_path(entry, [1])!;
    parent.list = [...(parent.list ?? []), create_map_edit_child('list')];
    const workingAfter = clone_working_map(entry);
    remove_node_at_path(workingAfter, [1]);
    const terminals = expand_terminal_deleted_paths(entry, [[1]]);
    expect(terminals).toContainEqual([1, 1]);
    expect(terminals).toContainEqual([1, 2]);
  });
});
