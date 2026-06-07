import { describe, expect, it } from 'vitest';
import {
  apply_map_edit_list_defaults,
  apply_map_edit_shloka_defaults,
  can_convert_childless_to_list,
  can_convert_childless_to_shloka,
  build_delete_review_state,
  clone_map_with_client_ids,
  clone_working_map,
  collect_unsaved_added_db_paths,
  collect_deleted_paths_from_entry,
  compute_map_edit_diff,
  create_map_edit_child,
  expand_terminal_deleted_paths,
  get_node_at_map_path,
  remove_node_at_path,
  strip_client_ids,
  UndoStack,
  UNDO_MAX_DEPTH,
  type BaselineNodeSnapshot,
  type MapNodeWithClientId
} from './map_edit_lib';
import { applyMetadataEditsToMap } from '~/server/map/path-swap';
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

const childless_shloka_root_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
  list: []
});

const childless_list_root_map = (): recursive_list_type => ({
  name_dev: 'Project',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: []
});

function setup_working() {
  const snapshots = new Map<string, BaselineNodeSnapshot>();
  const working = clone_map_with_client_ids(base_map(), null, 0, snapshots);
  return { working, snapshots };
}

describe('map_edit_lib normal-mode structure edits', () => {
  it('allows childless shloka project root to convert to list', () => {
    const snapshots = new Map<string, BaselineNodeSnapshot>();
    const working = clone_map_with_client_ids(childless_shloka_root_map(), null, 0, snapshots);
    expect(can_convert_childless_to_list(working)).toBe(true);
    expect(can_convert_childless_to_shloka(working)).toBe(false);

    apply_map_edit_list_defaults(working, { preserve_name_dev: true });
    expect(working.info.type).toBe('list');
    expect(working.name_dev).toBe('Project');

    const diff = compute_map_edit_diff(working, snapshots);
    expect(diff.dirty).toBe(true);
    expect(diff.rows.some((r) => r.kind === 'type_change' && r.pathLabel === '/')).toBe(true);

    const merged = applyMetadataEditsToMap(childless_shloka_root_map(), strip_client_ids(working));
    expect(merged.info.type).toBe('list');
    expect(merged.info.type === 'list' && merged.info.list_name).toBe('Level Name');
  });

  it('allows childless list project root to convert to shloka', () => {
    const snapshots = new Map<string, BaselineNodeSnapshot>();
    const working = clone_map_with_client_ids(childless_list_root_map(), null, 0, snapshots);
    expect(can_convert_childless_to_list(working)).toBe(false);
    expect(can_convert_childless_to_shloka(working)).toBe(true);

    apply_map_edit_shloka_defaults(working, { preserve_name_dev: true });
    expect(working.info.type).toBe('shloka');
    expect(working.name_dev).toBe('Project');

    const diff = compute_map_edit_diff(working, snapshots);
    expect(diff.dirty).toBe(true);
    expect(diff.rows.some((r) => r.kind === 'type_change' && r.pathLabel === '/')).toBe(true);

    const merged = applyMetadataEditsToMap(childless_list_root_map(), strip_client_ids(working));
    expect(merged.info).toEqual({
      type: 'shloka',
      shloka_count: 0,
      total: 0,
      shloka_count_expected: null
    });
  });

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

describe('map_edit_lib collect_unsaved_added_db_paths', () => {
  it('collects one appended child path', () => {
    const { working, snapshots } = setup_working();
    const listNode = get_node_at_map_path(working, [1])!;
    listNode.list = [...(listNode.list ?? []), create_map_edit_child('shloka')];

    expect(collect_unsaved_added_db_paths(working, snapshots)).toEqual(['1:2']);
  });

  it('collects nested paths for an appended subtree', () => {
    const { working, snapshots } = setup_working();
    const listNode = get_node_at_map_path(working, [1])!;
    const child = create_map_edit_child('list');
    child.list = [...(child.list ?? []), create_map_edit_child('shloka')];
    listNode.list = [...(listNode.list ?? []), child];

    expect(collect_unsaved_added_db_paths(working, snapshots)).toEqual(['1:2', '1:2:1']);
  });

  it('removes a newly added path when that node is deleted before save', () => {
    const { working, snapshots } = setup_working();
    const listNode = get_node_at_map_path(working, [1])!;
    listNode.list = [...(listNode.list ?? []), create_map_edit_child('shloka')];
    expect(collect_unsaved_added_db_paths(working, snapshots)).toEqual(['1:2']);

    remove_node_at_path(working, [1, 2]);
    expect(collect_unsaved_added_db_paths(working, snapshots)).toEqual([]);
  });

  it('restores the derived path list after undo-like state restoration', () => {
    const { working, snapshots } = setup_working();
    const beforeAdd = clone_working_map(working);
    const listNode = get_node_at_map_path(working, [1])!;
    listNode.list = [...(listNode.list ?? []), create_map_edit_child('shloka')];
    expect(collect_unsaved_added_db_paths(working, snapshots)).toEqual(['1:2']);

    const restored = clone_working_map(beforeAdd);
    expect(collect_unsaved_added_db_paths(restored, snapshots)).toEqual([]);
  });

  it('keeps a new node path when the node type changes before save', () => {
    const { working, snapshots } = setup_working();
    const listNode = get_node_at_map_path(working, [1])!;
    const added = create_map_edit_child('shloka');
    listNode.list = [...(listNode.list ?? []), added];
    expect(collect_unsaved_added_db_paths(working, snapshots)).toEqual(['1:2']);

    apply_map_edit_list_defaults(added);
    apply_map_edit_shloka_defaults(added);
    expect(collect_unsaved_added_db_paths(working, snapshots)).toEqual(['1:2']);
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

describe('UndoStack', () => {
  it('starts empty with canUndo=false', () => {
    const stack = new UndoStack<number>();
    expect(stack.canUndo).toBe(false);
    expect(stack.size).toBe(0);
    expect(stack.undo()).toBeNull();
  });

  it('push and undo return items in LIFO order', () => {
    const stack = new UndoStack<string>();
    stack.push('a');
    stack.push('b');
    stack.push('c');
    expect(stack.size).toBe(3);
    expect(stack.canUndo).toBe(true);
    expect(stack.undo()).toBe('c');
    expect(stack.undo()).toBe('b');
    expect(stack.undo()).toBe('a');
    expect(stack.undo()).toBeNull();
    expect(stack.canUndo).toBe(false);
  });

  it('clear empties the stack', () => {
    const stack = new UndoStack<number>();
    stack.push(1);
    stack.push(2);
    expect(stack.size).toBe(2);
    stack.clear();
    expect(stack.size).toBe(0);
    expect(stack.canUndo).toBe(false);
    expect(stack.undo()).toBeNull();
  });

  it('respects max depth and evicts oldest entries', () => {
    const stack = new UndoStack<number>(3);
    stack.push(1);
    stack.push(2);
    stack.push(3);
    stack.push(4); // evicts 1
    expect(stack.size).toBe(3);
    expect(stack.undo()).toBe(4);
    expect(stack.undo()).toBe(3);
    expect(stack.undo()).toBe(2);
    expect(stack.undo()).toBeNull();
  });

  it('works with snapshot-like objects', () => {
    type Snap = { workingMap: MapNodeWithClientId; selectedNodePath: number[] };
    const stack = new UndoStack<Snap>();
    const { working } = setup_working();
    const snap: Snap = {
      workingMap: clone_working_map(working),
      selectedNodePath: [1]
    };
    stack.push(snap);
    const restored = stack.undo();
    expect(restored).not.toBeNull();
    expect(restored!.selectedNodePath).toEqual([1]);
    expect(restored!.workingMap.name_dev).toBe('Project');
  });

  it('interleaved push and undo work correctly', () => {
    const stack = new UndoStack<number>();
    stack.push(10);
    stack.push(20);
    expect(stack.undo()).toBe(20);
    stack.push(30);
    expect(stack.size).toBe(2);
    expect(stack.undo()).toBe(30);
    expect(stack.undo()).toBe(10);
    expect(stack.undo()).toBeNull();
  });

  it('uses default max depth of UNDO_MAX_DEPTH', () => {
    const stack = new UndoStack<number>();
    for (let i = 0; i < 55; i++) {
      stack.push(i);
    }
    expect(stack.size).toBe(UNDO_MAX_DEPTH);
    // The first few entries should have been evicted
    const all: number[] = [];
    let v: number | null;
    while ((v = stack.undo()) !== null) all.push(v);
    // Should have entries 5..54 (i.e., the last 50)
    expect(all[0]).toBe(54);
    expect(all[all.length - 1]).toBe(5);
  });
});
