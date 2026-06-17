<script lang="ts">
  import { Map as MapIcon, ArrowUpDown, FolderRoot, Trash2, Undo2 } from '@lucide/svelte';
  import type { Tree as TreeComponent, LTreeNode, DropPosition } from '@keenmate/svelte-treeview';
  import { browser } from '$app/environment';
  import { beforeNavigate } from '$app/navigation';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { useTRPC } from '~/api/client';
  import {
    invalidate_project_content_queries,
    invalidate_project_map_queries,
    invalidate_project_registry_queries,
    project_map_q_options
  } from '~/state/main_app/data.svelte';
  import { project_state } from '~/state/main_app/state.svelte';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { map_edit_dirty } from '~/state/map_edit_dirty.svelte';
  import type { recursive_list_type } from '~/state/data_types';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import * as Breadcrumb from '$lib/components/ui/breadcrumb';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { toast } from 'svelte-sonner';
  import {
    type MapNodeWithClientId,
    type MapPath,
    type BaselineNodeSnapshot,
    type MapTreeItem,
    type MetadataUndoEntry,
    type OrderUndoEntry,
    type DeleteUndoEntry,
    UndoStack,
    produceWithPatches,
    applyPatches,
    clone_map_with_client_ids,
    strip_client_ids,
    is_path_valid,
    build_tree_rows,
    compute_map_edit_diff,
    get_node_at_map_path,
    get_parent_context,
    full_path_from_subtree_path,
    reorder_siblings,
    get_breadcrumb_segments,
    parse_optional_count,
    clone_baseline_snapshots,
    clone_working_map,
    clone_recursive_list,
    create_map_edit_child,
    apply_map_edit_list_defaults,
    apply_map_edit_shloka_defaults,
    can_convert_childless_to_list,
    can_convert_childless_to_shloka,
    MAP_EDIT_CLIENT_ID,
    format_path_resolved_label,
    paths_equal,
    default_tree_expanded_paths,
    expand_tree_expanded_paths,
    collapse_tree_expanded_paths,
    preserve_tree_expansion_for_path,
    build_delete_review_state,
    remove_node_at_path,
    is_ancestor_path,
    map_path_to_db_path,
    collect_unsaved_added_db_paths
  } from './map_edit_lib';
  import { buildAdjacentSwapEdits, type PathSwapEdit } from '~/utils/map_path/swap';
  import TreeEditPanel from './TreeEditPanel.svelte';
  import NodeEditor from './NodeEditor.svelte';
  import ChangesPanel from './ChangesPanel.svelte';
  import SaveReviewDialog from './SaveReviewDialog.svelte';

  let {
    project_id,
    project_name_dev
  }: {
    project_id: number;
    project_name_dev: string;
  } = $props();

  const trpc = useTRPC();

  const project_map_q = createQuery(() => project_map_q_options($project_state));

  let baselineMap = $state<recursive_list_type | null>(null);
  let workingMap = $state<MapNodeWithClientId | null>(null);
  let baselineSnapshots = $state<Map<string, BaselineNodeSnapshot>>(new Map());
  let selectedNodePath = $state<MapPath>([]);
  let basePath = $state<MapPath>([]);
  let save_review_open = $state(false);
  let save_review_mode = $state<'metadata' | 'order' | 'delete'>('metadata');
  let discard_dialog_open = $state(false);
  let discard_order_dialog_open = $state(false);
  let discard_delete_dialog_open = $state(false);
  let editor_mode = $state<'metadata' | 'order' | 'delete'>('metadata');
  /** List node whose direct children may be reordered; `null` until the user picks one. */
  let order_root_path = $state<MapPath | null>(null);
  let order_entry_map = $state<MapNodeWithClientId | null>(null);
  let order_entry_snapshots = $state<Map<string, BaselineNodeSnapshot>>(new Map());
  let delete_entry_map = $state<MapNodeWithClientId | null>(null);
  let pending_swaps = $state<PathSwapEdit[]>([]);
  let count_input_invalid = $state(false);
  let treeRef = $state<TreeComponent<MapTreeItem> | undefined>(undefined);
  /** True from confirm through cache invalidation and map reset (after mutation settles). */
  let finishing_save = $state(false);
  let last_tree_click = $state<{ path: string; at: number } | null>(null);
  let expandedTreePaths = $state<Set<string>>(default_tree_expanded_paths());

  // ── Undo stacks (one per mode) ──
  // Plain variables — mutations are internal to UndoStack; reactivity is
  // tracked entirely through `undo_version`.
  let metadata_undo = new UndoStack<MetadataUndoEntry>();
  let order_undo = new UndoStack<OrderUndoEntry>();
  let delete_undo = new UndoStack<DeleteUndoEntry>();
  /** Bumped after every push/undo/clear so Svelte re-derives `can_undo`. */
  let undo_version = $state(0);
  const can_undo = $derived.by(() => {
    undo_version; // reactive dependency
    if (editor_mode === 'order') return order_undo.canUndo;
    if (editor_mode === 'delete') return delete_undo.canUndo;
    return metadata_undo.canUndo;
  });
  const undo_stack_size = $derived.by(() => {
    undo_version;
    if (editor_mode === 'order') return order_undo.size;
    if (editor_mode === 'delete') return delete_undo.size;
    return metadata_undo.size;
  });

  const TREE_DBLCLICK_MS = 400;

  const diffState = $derived.by(() => {
    if (!workingMap) {
      return {
        dirty: false,
        changedNodeCount: 0,
        renameCount: 0,
        reorderedParentCount: 0,
        rows: [],
        flagsByClientId: new Map()
      };
    }
    return compute_map_edit_diff(workingMap, baselineSnapshots);
  });

  const order_edit_mode = $derived(editor_mode === 'order');
  const delete_edit_mode = $derived(editor_mode === 'delete');

  const order_diff_state = $derived.by(() => {
    if (!workingMap || !order_edit_mode) {
      return {
        dirty: false,
        changedNodeCount: 0,
        renameCount: 0,
        reorderedParentCount: 0,
        rows: [],
        flagsByClientId: new Map()
      };
    }
    return compute_map_edit_diff(workingMap, order_entry_snapshots, { kinds: ['reorder'] });
  });

  const delete_review_state = $derived.by(() => {
    if (!workingMap || !delete_edit_mode || !delete_entry_map) {
      return { deletedRoots: [], terminalPaths: [], rows: [] };
    }
    return build_delete_review_state(delete_entry_map, workingMap);
  });

  const active_diff_state = $derived(order_edit_mode ? order_diff_state : diffState);
  const order_dirty = $derived(
    order_edit_mode && (pending_swaps.length > 0 || order_diff_state.dirty)
  );
  const delete_dirty = $derived(delete_edit_mode && delete_review_state.deletedRoots.length > 0);
  const metadata_dirty = $derived(editor_mode === 'metadata' && diffState.dirty);
  const metadata_field_dirty = $derived.by(() => {
    if (!workingMap || editor_mode !== 'metadata') return false;
    return compute_map_edit_diff(workingMap, baselineSnapshots, {
      kinds: ['rename', 'list_name_change', 'expected_count_change', 'add_child', 'type_change']
    }).dirty;
  });
  const metadata_to_add_paths = $derived.by(() => {
    if (!workingMap || editor_mode !== 'metadata') return [] as string[];
    return collect_unsaved_added_db_paths(workingMap, baselineSnapshots);
  });

  const order_root_selected = $derived(order_edit_mode && order_root_path !== null);
  const order_root_awaiting = $derived(order_edit_mode && order_root_path === null);

  const treeData = $derived.by((): MapTreeItem[] => {
    if (!workingMap) return [];
    return build_tree_rows(
      workingMap,
      basePath,
      active_diff_state.flagsByClientId,
      untrack(() => selectedNodePath),
      order_root_selected,
      expandedTreePaths,
      order_root_selected
    );
  });

  const selectedNode = $derived.by(() => {
    if (!workingMap) return null;
    return get_node_at_map_path(workingMap, selectedNodePath);
  });

  const breadcrumb_segments = $derived.by(() => {
    if (!workingMap) return [];
    return get_breadcrumb_segments(workingMap, basePath);
  });

  const selected_is_root = $derived(selectedNodePath.length === 0);
  const base_path_active = $derived(basePath.length > 0);
  const selected_path_resolved = $derived(
    workingMap ? format_path_resolved_label(workingMap, selectedNodePath) : ''
  );
  const base_path_resolved = $derived(
    workingMap ? format_path_resolved_label(workingMap, basePath) : '/'
  );
  const order_root_resolved = $derived(
    workingMap && order_root_path !== null
      ? format_path_resolved_label(workingMap, order_root_path)
      : ''
  );

  let list_count_draft = $state('');
  let leave_confirmed = false;

  $effect(() => {
    const dirty = metadata_dirty || order_dirty || delete_dirty;
    if (get(map_edit_dirty) !== dirty) map_edit_dirty.set(dirty);
  });

  let last_synced_map_key = '';

  $effect(() => {
    const map = project_map_q.data;
    if (!map || metadata_dirty || order_dirty || delete_dirty) return;
    const map_key = JSON.stringify(map);
    if (last_synced_map_key === map_key) return;
    last_synced_map_key = map_key;
    reset_from_server(map);
  });

  $effect(() => {
    selectedNode;
    if (!selectedNode || selectedNode.info.type !== 'list') {
      list_count_draft = '';
      count_input_invalid = false;
      return;
    }
    const v = selectedNode.info.list_count_expected;
    list_count_draft = v === null || v === undefined ? '' : String(v);
    count_input_invalid = false;
  });

  const finish_save = async (
    map: recursive_list_type,
    options: { invalidateContent: boolean; successMessage: string }
  ) => {
    await invalidate_project_registry_queries(project_id);
    await invalidate_project_map_queries(project_id);
    if (options.invalidateContent) {
      await invalidate_project_content_queries(project_id);
    }
    last_synced_map_key = JSON.stringify(map);
    reset_from_server(map);
    save_review_open = false;
    editor_mode = 'metadata';
    order_root_path = null;
    order_entry_map = null;
    delete_entry_map = null;
    pending_swaps = [];
    clear_all_undo_stacks();
    map_edit_dirty.set(false);
    toast.success(options.successMessage);
    finishing_save = false;
  };

  const save_mut = createMutation(() =>
    trpc.project.map_edit.update.mutationOptions({
      onSuccess: async (data) => {
        await finish_save(data.map, {
          invalidateContent: false,
          successMessage: 'Project map saved'
        });
      },
      onError: (err) => {
        finishing_save = false;
        toast.error(err.message || 'Failed to save project map');
      }
    })
  );

  const save_order_mut = createMutation(() =>
    trpc.project.map_edit.save_order.mutationOptions({
      onSuccess: async (data) => {
        await finish_save(data.map, {
          invalidateContent: true,
          successMessage: 'List order saved'
        });
      },
      onError: (err) => {
        finishing_save = false;
        toast.error(err.message || 'Failed to save list order');
      }
    })
  );

  const save_delete_mut = createMutation(() =>
    trpc.project.map_edit.delete_nodes.mutationOptions({
      onSuccess: async (data) => {
        await finish_save(data.map, {
          invalidateContent: true,
          successMessage: 'Deleted nodes saved'
        });
      },
      onError: (err) => {
        finishing_save = false;
        toast.error(err.message || 'Failed to delete map nodes');
      }
    })
  );

  const save_in_flight = $derived(
    save_mut.isPending || save_order_mut.isPending || save_delete_mut.isPending || finishing_save
  );

  function reset_from_server(map: recursive_list_type) {
    const snapshots = new Map<string, BaselineNodeSnapshot>();
    const plain = clone_recursive_list(map);
    baselineMap = plain;
    workingMap = clone_map_with_client_ids(plain, null, 0, snapshots);
    baselineSnapshots = snapshots;
    basePath = [];
    selectedNodePath = [];
    expandedTreePaths = default_tree_expanded_paths();
  }

  function reset_tree_expansion() {
    expandedTreePaths = default_tree_expanded_paths();
  }

  function bump_working() {
    if (!workingMap) return;
    workingMap = clone_working_map(workingMap);
  }

  function mark_local_change() {
    leave_confirmed = false;
  }

  // ── Undo helpers ──

  /**
   * Run `recipe` on `workingMap` via immer's `produceWithPatches`.
   *
   * - If `groupWithTop` is true AND there's already a top entry on the stack,
   *   the new inversePatches are PREPENDED to the existing top entry's patches
   *   (so the whole editing session becomes one undo step).
   * - Otherwise a new entry is pushed.
   *
   * Returns the new map.
   */
  function mutate_metadata(
    recipe: (draft: MapNodeWithClientId) => void,
    { groupWithTop = false }: { groupWithTop?: boolean } = {}
  ): MapNodeWithClientId | null {
    if (!workingMap) return null;
    const plain = $state.snapshot(workingMap);
    const [nextMap, , inversePatches] = produceWithPatches(plain, recipe);
    const top = groupWithTop ? metadata_undo.peek() : null;
    if (top) {
      // Merge: prepend new inversePatches so undoing replays them in reverse order
      top.inversePatches = [...inversePatches, ...top.inversePatches];
    } else {
      metadata_undo.push({ inversePatches, selectedNodePath: [...selectedNodePath] });
    }
    undo_version++;
    return nextMap as MapNodeWithClientId;
  }

  /**
   * Run `recipe` on `workingMap` via immer for an order-mode edit.
   * Stores inversePatches + current pendingSwaps as the undo entry.
   */
  function mutate_order(recipe: (draft: MapNodeWithClientId) => void): MapNodeWithClientId | null {
    if (!workingMap) return null;
    const plain = $state.snapshot(workingMap);
    const [nextMap, , inversePatches] = produceWithPatches(plain, recipe);
    order_undo.push({
      inversePatches,
      pendingSwaps: [...pending_swaps],
      selectedNodePath: [...selectedNodePath]
    });
    undo_version++;
    return nextMap as MapNodeWithClientId;
  }

  /**
   * Run `recipe` on `workingMap` via immer for a delete-mode edit.
   * Returns null if the recipe didn't actually change anything (remove failed).
   */
  function mutate_delete(
    recipe: (draft: MapNodeWithClientId) => boolean
  ): MapNodeWithClientId | null {
    if (!workingMap) return null;
    let changed = false;
    const plain = $state.snapshot(workingMap);
    const [nextMap, , inversePatches] = produceWithPatches(plain, (draft) => {
      changed = recipe(draft);
    });
    if (!changed) return null;
    delete_undo.push({ inversePatches, selectedNodePath: [...selectedNodePath] });
    undo_version++;
    return nextMap as MapNodeWithClientId;
  }

  function clear_all_undo_stacks() {
    metadata_undo.clear();
    order_undo.clear();
    delete_undo.clear();
    undo_version++;
  }

  function undo_action() {
    if (save_in_flight || !workingMap) return;
    const plain = $state.snapshot(workingMap);
    if (editor_mode === 'order') {
      const entry = order_undo.undo();
      if (!entry) return;
      workingMap = applyPatches(plain, entry.inversePatches) as MapNodeWithClientId;
      pending_swaps = entry.pendingSwaps;
      selectedNodePath = entry.selectedNodePath;
    } else if (editor_mode === 'delete') {
      const entry = delete_undo.undo();
      if (!entry) return;
      workingMap = applyPatches(plain, entry.inversePatches) as MapNodeWithClientId;
      selectedNodePath = entry.selectedNodePath;
    } else {
      const entry = metadata_undo.undo();
      if (!entry) return;
      workingMap = applyPatches(plain, entry.inversePatches) as MapNodeWithClientId;
      selectedNodePath = entry.selectedNodePath;
    }
    undo_version++;
  }

  function select_node_by_subtree_path(subtreePath: string) {
    if (!workingMap || save_in_flight) return;
    const full = full_path_from_subtree_path(basePath, subtreePath);
    if (!get_node_at_map_path(workingMap, full)) return;
    selectedNodePath = full;
  }

  function set_base_path(path: MapPath) {
    if (
      !workingMap ||
      save_in_flight ||
      !is_path_valid(workingMap, path) ||
      editor_mode !== 'metadata'
    )
      return;
    basePath = path;
    if (!is_path_valid(workingMap, selectedNodePath)) {
      selectedNodePath = path.length === 0 ? [] : path;
    }
    reset_tree_expansion();
  }

  function promote_change_root(subtreePath: string) {
    if (!workingMap || save_in_flight) return;
    const full = full_path_from_subtree_path(basePath, subtreePath);
    if (!get_node_at_map_path(workingMap, full)) return;
    basePath = full;
    selectedNodePath = full;
    reset_tree_expansion();
  }

  function toggle_tree_path_expanded(relPath: string) {
    expandedTreePaths = expandedTreePaths.has(relPath)
      ? collapse_tree_expanded_paths(expandedTreePaths, relPath)
      : expand_tree_expanded_paths(expandedTreePaths, relPath);
  }

  function select_order_root(subtreePath: string) {
    if (!workingMap || save_in_flight || !order_root_awaiting) return;
    const full = full_path_from_subtree_path(basePath, subtreePath);
    const node = get_node_at_map_path(workingMap, full);
    if (!node || node.info.type !== 'list') {
      toast.error('Select a list node to reorder its direct children');
      return;
    }
    if ((node.list ?? []).length < 2) {
      toast.error('This list needs at least two children to reorder');
      return;
    }
    order_root_path = full;
    basePath = full;
    selectedNodePath = full;
    reset_tree_expansion();
  }

  function on_tree_node_clicked(node: LTreeNode<MapTreeItem>) {
    if (save_in_flight) return;
    const row = node.data;
    if (!row) return;

    if (order_root_awaiting) {
      select_order_root(node.path ?? row.path);
      return;
    }
    if (order_edit_mode) return;

    const subtreePath = node.path ?? row.path;
    const now = Date.now();
    const is_double =
      last_tree_click?.path === subtreePath && now - last_tree_click.at < TREE_DBLCLICK_MS;

    if (is_double) {
      last_tree_click = null;
      if (row.nodeType === 'list' && row.childCount > 0) {
        toggle_tree_path_expanded(subtreePath);
      }
      return;
    }

    last_tree_click = { path: subtreePath, at: now };
    select_node_by_subtree_path(subtreePath);
  }

  function on_set_tree_root_click(e: MouseEvent, subtreePath: string) {
    e.stopPropagation();
    e.preventDefault();
    if (save_in_flight) return;
    promote_change_root(subtreePath);
  }

  function update_name_dev(value: string) {
    if (!selectedNode || selected_is_root || save_in_flight) return;
    mark_local_change();
    const fresh = _input_field_fresh_focus;
    _input_field_fresh_focus = false;
    const next = mutate_metadata(
      (draft) => {
        const node = get_node_at_map_path(draft, selectedNodePath);
        if (node) node.name_dev = value;
      },
      { groupWithTop: !fresh }
    );
    if (next) workingMap = next;
  }

  function update_list_name(value: string) {
    if (!selectedNode || selectedNode.info.type !== 'list' || save_in_flight) return;
    mark_local_change();
    const fresh = _input_field_fresh_focus;
    _input_field_fresh_focus = false;
    const next = mutate_metadata(
      (draft) => {
        const node = get_node_at_map_path(draft, selectedNodePath);
        if (node && node.info.type === 'list') node.info.list_name = value;
      },
      { groupWithTop: !fresh }
    );
    if (next) workingMap = next;
  }

  function update_list_count_expected(raw: string) {
    if (!selectedNode || selectedNode.info.type !== 'list' || save_in_flight) return;
    const parsed = parse_optional_count(raw);
    if (parsed === 'invalid') {
      count_input_invalid = true;
      return;
    }
    mark_local_change();
    count_input_invalid = false;
    const fresh = _input_field_fresh_focus;
    _input_field_fresh_focus = false;
    const next = mutate_metadata(
      (draft) => {
        const node = get_node_at_map_path(draft, selectedNodePath);
        if (node && node.info.type === 'list') node.info.list_count_expected = parsed;
      },
      { groupWithTop: !fresh }
    );
    if (next) workingMap = next;
  }

  /**
   * Called when any input field gains focus.
   * Sets a flag so the NEXT keystroke pushes a fresh entry.
   * Subsequent keystrokes in the same session are merged into that entry
   * (groupWithTop=true), so the whole typing session is one undo step.
   * Skips if nothing has changed since the last push (repeated focus with no edit).
   */
  function on_input_field_focus() {
    if (!workingMap || save_in_flight || editor_mode !== 'metadata') return;
    // No new edits since last snapshot — don't start a new group.
    if (metadata_undo.canUndo && !diffState.dirty) return;
    _input_field_fresh_focus = true;
  }

  /**
   * True after a focus event, until the first keystroke of that session.
   * The first keystroke pushes a new undo entry; subsequent ones merge into it.
   */
  let _input_field_fresh_focus = false;

  function on_delete_node_click(e: MouseEvent, subtreePath: string) {
    e.stopPropagation();
    e.preventDefault();
    delete_node_at_subtree_path(subtreePath);
  }

  function delete_node_at_subtree_path(subtreePath: string) {
    if (!workingMap || !delete_edit_mode || save_in_flight) return;
    const full = full_path_from_subtree_path(basePath, subtreePath);
    if (full.length === 0) return;
    const next = mutate_delete((draft) => remove_node_at_path(draft, full));
    if (!next) return;
    workingMap = next;
    const parentPath = full.slice(0, -1);
    const removedIndex = full[full.length - 1]!;
    if (paths_equal(selectedNodePath, full) || is_ancestor_path(full, selectedNodePath)) {
      selectedNodePath =
        is_path_valid(workingMap, parentPath) && parentPath.length > 0
          ? parentPath
          : basePath.length
            ? [...basePath]
            : [];
    } else if (
      paths_equal(selectedNodePath.slice(0, -1), parentPath) &&
      selectedNodePath[selectedNodePath.length - 1]! > removedIndex
    ) {
      const shiftedPath = [...selectedNodePath];
      shiftedPath[shiftedPath.length - 1] = shiftedPath[shiftedPath.length - 1]! - 1;
      selectedNodePath = is_path_valid(workingMap, shiftedPath)
        ? shiftedPath
        : is_path_valid(workingMap, parentPath) && parentPath.length > 0
          ? parentPath
          : basePath.length
            ? [...basePath]
            : [];
    }
  }

  function append_child(kind: 'shloka' | 'list') {
    if (
      !selectedNode ||
      selectedNode.info.type !== 'list' ||
      editor_mode !== 'metadata' ||
      save_in_flight
    ) {
      return;
    }
    mark_local_change();
    const next = mutate_metadata((draft) => {
      const node = get_node_at_map_path(draft, selectedNodePath);
      if (node && node.info.type === 'list') {
        node.list = [...(node.list ?? []), create_map_edit_child(kind)];
      }
    });
    if (next) workingMap = next;
  }

  function convert_selected_to_list() {
    if (!workingMap || editor_mode !== 'metadata' || save_in_flight) return;
    const node = get_node_at_map_path(workingMap, selectedNodePath);
    if (!can_convert_childless_to_list(node)) return;
    mark_local_change();
    const preserve_name_dev = selected_is_root;
    const expanded_before = new Set(expandedTreePaths);
    const next = mutate_metadata((draft) => {
      const draftNode = get_node_at_map_path(draft, selectedNodePath);
      if (draftNode) apply_map_edit_list_defaults(draftNode, { preserve_name_dev });
    });
    if (next) {
      workingMap = next;
      expandedTreePaths = preserve_tree_expansion_for_path(
        expanded_before,
        basePath,
        selectedNodePath
      );
    }
  }

  function convert_selected_to_shloka() {
    if (!workingMap || editor_mode !== 'metadata' || save_in_flight) return;
    const node = get_node_at_map_path(workingMap, selectedNodePath);
    if (!can_convert_childless_to_shloka(node)) return;
    mark_local_change();
    const preserve_name_dev = selected_is_root;
    const expanded_before = new Set(expandedTreePaths);
    const next = mutate_metadata((draft) => {
      const draftNode = get_node_at_map_path(draft, selectedNodePath);
      if (draftNode) apply_map_edit_shloka_defaults(draftNode, { preserve_name_dev });
    });
    if (next) {
      workingMap = next;
      expandedTreePaths = preserve_tree_expansion_for_path(
        expanded_before,
        basePath,
        selectedNodePath
      );
    }
  }

  async function before_drop(
    dropNode: LTreeNode<MapTreeItem> | null,
    draggedNode: LTreeNode<MapTreeItem>,
    position: DropPosition
  ) {
    if (
      !workingMap ||
      save_in_flight ||
      !order_root_selected ||
      order_root_path === null ||
      position === 'child' ||
      !dropNode?.path
    ) {
      return false;
    }

    const draggedFull = full_path_from_subtree_path(basePath, draggedNode.path);
    const targetFull = full_path_from_subtree_path(basePath, dropNode.path);
    if (draggedFull.length === 0) return false;

    const draggedCtx = get_parent_context(workingMap, draggedFull);
    const targetCtx = get_parent_context(workingMap, targetFull);
    if (!draggedCtx || !targetCtx) return false;
    if (draggedCtx.parent[MAP_EDIT_CLIENT_ID] !== targetCtx.parent[MAP_EDIT_CLIENT_ID]) {
      return false;
    }
    if (!paths_equal(draggedCtx.parentPath, order_root_path)) {
      return false;
    }

    let toIndex = targetCtx.index;
    if (position === 'below') toIndex += 1;
    if (draggedCtx.index < toIndex) toIndex -= 1;

    if (draggedCtx.index === toIndex) return false;

    const fromIndex = draggedCtx.index;
    const next = mutate_order((draft) => {
      reorder_siblings(draft, draggedCtx.parentPath, fromIndex, toIndex);
    });
    if (next) {
      workingMap = next;
      mark_local_change();
      record_pending_swap(draggedCtx.parentPath, fromIndex, toIndex);
    }
    return false;
  }

  function record_pending_swap(parentPath: MapPath, from_index: number, to_index: number) {
    if (order_root_path === null || !paths_equal(parentPath, order_root_path)) return;
    pending_swaps = [...pending_swaps, ...buildAdjacentSwapEdits(parentPath, from_index, to_index)];
  }

  function enter_order_edit_mode() {
    if (!workingMap || editor_mode !== 'metadata' || save_in_flight) return;
    if (metadata_field_dirty) {
      toast.error('Save or discard map edits before changing order');
      return;
    }
    clear_all_undo_stacks();
    order_entry_map = clone_working_map(workingMap);
    order_entry_snapshots = clone_baseline_snapshots(baselineSnapshots);
    pending_swaps = [];
    order_root_path = null;
    basePath = [];
    selectedNodePath = [];
    reset_tree_expansion();
    editor_mode = 'order';
  }

  function enter_delete_edit_mode() {
    if (!workingMap || editor_mode !== 'metadata' || save_in_flight) return;
    if (metadata_field_dirty) {
      toast.error('Save or discard map edits before deleting nodes');
      return;
    }
    clear_all_undo_stacks();
    delete_entry_map = clone_working_map(workingMap);
    basePath = [];
    selectedNodePath = [];
    reset_tree_expansion();
    editor_mode = 'delete';
  }

  function cancel_order_edit() {
    if (!order_edit_mode || save_in_flight) return;
    if (!order_dirty) {
      clear_all_undo_stacks();
      editor_mode = 'metadata';
      order_root_path = null;
      order_entry_map = null;
      pending_swaps = [];
      basePath = [];
      selectedNodePath = [];
      reset_tree_expansion();
      return;
    }
    discard_order_dialog_open = true;
  }

  function cancel_delete_edit() {
    if (!delete_edit_mode || save_in_flight) return;
    if (!delete_dirty) {
      clear_all_undo_stacks();
      editor_mode = 'metadata';
      delete_entry_map = null;
      basePath = [];
      selectedNodePath = [];
      reset_tree_expansion();
      return;
    }
    discard_delete_dialog_open = true;
  }

  function confirm_cancel_order_edit() {
    if (order_entry_map) {
      workingMap = clone_working_map(order_entry_map);
      baselineSnapshots = clone_baseline_snapshots(order_entry_snapshots);
    }
    pending_swaps = [];
    clear_all_undo_stacks();
    editor_mode = 'metadata';
    order_root_path = null;
    order_entry_map = null;
    basePath = [];
    selectedNodePath = [];
    reset_tree_expansion();
    discard_order_dialog_open = false;
    map_edit_dirty.set(false);
  }

  function confirm_cancel_delete_edit() {
    if (delete_entry_map) {
      workingMap = clone_working_map(delete_entry_map);
    }
    clear_all_undo_stacks();
    editor_mode = 'metadata';
    delete_entry_map = null;
    basePath = [];
    selectedNodePath = [];
    reset_tree_expansion();
    discard_delete_dialog_open = false;
    map_edit_dirty.set(false);
  }

  function request_save_order() {
    if (save_in_flight) return;
    if (order_diff_state.dirty && pending_swaps.length === 0) {
      toast.error('Order changes are out of sync. Reopen order edit and try again.');
      return;
    }
    if (!order_dirty || !order_root_selected || pending_swaps.length === 0) return;
    save_review_mode = 'order';
    save_review_open = true;
  }

  function request_save_delete() {
    if (save_in_flight || !delete_dirty) return;
    save_review_mode = 'delete';
    save_review_open = true;
  }

  async function confirm_save_delete() {
    if (!workingMap || save_in_flight || !delete_dirty || !delete_entry_map) return;
    const deletedDbPaths = delete_review_state.deletedRoots.map((path) =>
      map_path_to_db_path(path)
    );
    finishing_save = true;
    try {
      await save_delete_mut.mutateAsync({
        project_id,
        deleted_paths: deletedDbPaths
      });
    } catch {
      finishing_save = false;
    }
  }

  async function confirm_save_order() {
    if (!workingMap || save_in_flight || !order_root_selected || pending_swaps.length === 0) {
      return;
    }
    finishing_save = true;
    try {
      await save_order_mut.mutateAsync({
        project_id,
        root_path: [...order_root_path!],
        edits: pending_swaps,
        map: strip_client_ids(workingMap)
      });
    } catch {
      finishing_save = false;
    }
  }

  function get_allowed_drop_positions(node: LTreeNode<MapTreeItem>) {
    if (!node.data?.draggable) return [] as DropPosition[];
    return ['above', 'below'] as DropPosition[];
  }

  function request_save() {
    if (save_in_flight || editor_mode !== 'metadata' || !diffState.dirty || count_input_invalid)
      return;
    save_review_mode = 'metadata';
    save_review_open = true;
  }

  async function confirm_save() {
    if (!workingMap || save_in_flight) return;
    finishing_save = true;
    try {
      await save_mut.mutateAsync({
        project_id,
        map: strip_client_ids(workingMap),
        to_add_paths: metadata_to_add_paths
      });
    } catch {
      finishing_save = false;
    }
  }

  function request_cancel() {
    if (save_in_flight) return;
    if (delete_edit_mode) {
      cancel_delete_edit();
      return;
    }
    if (order_edit_mode) {
      cancel_order_edit();
      return;
    }
    if (!diffState.dirty) {
      selectedNodePath = basePath.length ? [...basePath] : [];
      return;
    }
    discard_dialog_open = true;
  }

  function restore_from_baseline() {
    if (!baselineMap) return;
    reset_from_server(baselineMap);
    clear_all_undo_stacks();
    count_input_invalid = false;
    map_edit_dirty.set(false);
  }

  function confirm_discard() {
    restore_from_baseline();
    discard_dialog_open = false;
  }

  onMount(() => {
    if (!browser) return;
    const on_beforeunload = (e: BeforeUnloadEvent) => {
      if (get(map_edit_dirty)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const on_keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo_action();
      }
    };
    window.addEventListener('beforeunload', on_beforeunload);
    window.addEventListener('keydown', on_keydown);
    return () => {
      window.removeEventListener('beforeunload', on_beforeunload);
      window.removeEventListener('keydown', on_keydown);
    };
  });

  onDestroy(() => {
    map_edit_dirty.set(false);
  });

  beforeNavigate(({ cancel }) => {
    if ((!metadata_dirty && !order_dirty && !delete_dirty) || leave_confirmed) return;
    const message = delete_dirty
      ? 'You have unsaved node deletions. Leave this page and discard them?'
      : order_dirty
        ? 'You have unsaved order changes. Leave this page and discard them?'
        : 'You have unsaved map edits. Leave this page and discard them?';
    const ok = confirm(message);
    if (!ok) cancel();
    else {
      leave_confirmed = true;
      queueMicrotask(() => {
        leave_confirmed = false;
      });
    }
  });
</script>

<div class="flex flex-col gap-4">
  <Card.Root class="overflow-hidden border-t-2 border-t-primary/60">
    <Card.Header class="gap-3 pb-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            {#if delete_edit_mode}
              <Trash2 class="size-4" />
            {:else if order_edit_mode}
              <ArrowUpDown class="size-4" />
            {:else}
              <MapIcon class="size-4" />
            {/if}
          </div>
          <div class="space-y-0.5">
            <Card.Title class="text-base">
              {delete_edit_mode
                ? 'Delete map nodes'
                : order_edit_mode
                  ? 'Edit list order'
                  : 'Edit project map'}
            </Card.Title>
            <Card.Description class="text-sm">{project_name_dev}</Card.Description>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          {#if delete_edit_mode && delete_dirty}
            <Badge variant="destructive" class="tabular-nums">
              {delete_review_state.terminalPaths.length} path{delete_review_state.terminalPaths
                .length === 1
                ? ''
                : 's'}
            </Badge>
          {:else if order_edit_mode && order_dirty}
            <Badge variant="secondary" class="tabular-nums">
              {pending_swaps.length} swap{pending_swaps.length === 1 ? '' : 's'}
            </Badge>
          {:else if metadata_dirty}
            <Badge variant="secondary" class="tabular-nums">
              {diffState.rows.length} update{diffState.rows.length === 1 ? '' : 's'}
            </Badge>
          {/if}
          {#if delete_edit_mode}
            <Button
              variant="outline"
              size="sm"
              onclick={undo_action}
              disabled={!can_undo || save_in_flight}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 class="mr-1 size-3.5" />
              Undo{undo_stack_size > 0 ? ` (${undo_stack_size})` : ''}
            </Button>
            <Button variant="outline" size="sm" onclick={cancel_delete_edit}
              >Cancel delete mode</Button
            >
            <Button
              variant="destructive"
              size="sm"
              onclick={request_save_delete}
              disabled={!delete_dirty || save_in_flight}
            >
              {save_in_flight ? 'Saving…' : 'Save deletions'}
            </Button>
          {:else if order_edit_mode}
            <Button
              variant="outline"
              size="sm"
              onclick={undo_action}
              disabled={!can_undo || save_in_flight}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 class="mr-1 size-3.5" />
              Undo{undo_stack_size > 0 ? ` (${undo_stack_size})` : ''}
            </Button>
            <Button variant="outline" size="sm" onclick={cancel_order_edit}
              >Cancel order edit</Button
            >
            <Button
              size="sm"
              onclick={request_save_order}
              disabled={!order_dirty ||
                !order_root_selected ||
                pending_swaps.length === 0 ||
                save_in_flight}
            >
              {save_in_flight ? 'Saving…' : 'Save current order'}
            </Button>
          {:else}
            <Button
              variant="outline"
              size="sm"
              onclick={undo_action}
              disabled={!can_undo || save_in_flight}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 class="mr-1 size-3.5" />
              Undo{undo_stack_size > 0 ? ` (${undo_stack_size})` : ''}
            </Button>
            <Button variant="outline" size="sm" onclick={request_cancel}>Cancel</Button>
            <Button
              size="sm"
              onclick={request_save}
              disabled={!metadata_dirty || save_in_flight || count_input_invalid}
            >
              {save_in_flight ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="border-amber-800/35 bg-amber-950/8 text-amber-950 hover:bg-amber-950/12 dark:border-amber-300/45 dark:bg-amber-400/12 dark:text-amber-100 dark:hover:bg-amber-400/18"
              disabled={metadata_field_dirty}
              onclick={enter_order_edit_mode}
            >
              <ArrowUpDown class="mr-1 size-3.5" />
              Edit order
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="border-destructive/35 bg-destructive/8 text-destructive hover:bg-destructive/12 dark:border-red-400/45 dark:bg-red-400/12 dark:text-red-200 dark:hover:bg-red-400/18"
              disabled={metadata_field_dirty}
              onclick={enter_delete_edit_mode}
            >
              <Trash2 class="mr-1 size-3.5" />
              Delete nodes
            </Button>
          {/if}
        </div>
      </div>

      <Breadcrumb.Root>
        <Breadcrumb.List>
          {#each breadcrumb_segments as seg, i (seg.path.join('-'))}
            {#if i > 0}
              <Breadcrumb.Separator />
            {/if}
            <Breadcrumb.Item>
              {#if i === breadcrumb_segments.length - 1}
                <Breadcrumb.Page>{seg.label}</Breadcrumb.Page>
              {:else}
                <button
                  type="button"
                  class="text-muted-foreground transition-colors hover:text-foreground"
                  onclick={() => set_base_path(seg.path)}
                >
                  {seg.label}
                </button>
              {/if}
            </Breadcrumb.Item>
          {/each}
        </Breadcrumb.List>
      </Breadcrumb.Root>

      {#if delete_edit_mode}
        <div class="rounded-md bg-destructive/8 px-3 py-1.5 dark:bg-destructive/12">
          <p class="text-xs text-destructive dark:text-red-300">
            Click the trash icon on any node except the project root. Review connected texts,
            translations, and media in the changes panel before saving.
          </p>
          <p class="mt-1 text-[11px] text-destructive/90 dark:text-red-300/90">
            Deleting a non-last sibling shifts later paths too. Example: deleting `1/2` makes old
            `1/3` become `1/2`.
          </p>
        </div>
      {:else if !order_edit_mode}
        <div class="flex flex-wrap items-center gap-3 rounded-md bg-muted/40 px-3 py-1.5">
          <p class="text-xs text-muted-foreground">
            Hover a branch with children and use
            <FolderRoot class="inline size-3 align-text-bottom text-primary" />
            to set tree root. Double-click a node to expand or collapse.
          </p>
          {#if base_path_active}
            <Button variant="ghost" size="sm" class="h-6 text-xs" onclick={() => set_base_path([])}>
              ← Back to full tree
            </Button>
          {/if}
        </div>
      {:else if order_root_awaiting}
        <div class="rounded-md bg-amber-500/8 px-3 py-1.5 dark:bg-amber-400/8">
          <p class="text-xs text-amber-800 dark:text-amber-300">
            Click a list node in the tree that has at least two children to choose what you want to
            reorder.
          </p>
        </div>
      {:else}
        <div class="rounded-md bg-amber-500/8 px-3 py-1.5 dark:bg-amber-400/8">
          <p class="text-xs text-amber-800 dark:text-amber-300">
            You can reorder direct children in <span
              class="font-medium text-amber-950 dark:text-amber-100">{order_root_resolved}</span
            >. Drag rows with the grip handle only.
          </p>
          <p class="mt-1 text-[11px] text-amber-800/90 dark:text-amber-300/90">
            Saving order changes child paths and path-based endpoints. Example: moving `1/3` above
            `1/2` swaps those paths.
          </p>
        </div>
      {/if}
    </Card.Header>
  </Card.Root>

  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
    <TreeEditPanel
      {workingMap}
      {treeData}
      editor_locked={save_in_flight}
      {editor_mode}
      {order_root_awaiting}
      {order_root_selected}
      {order_root_resolved}
      {base_path_resolved}
      bind:treeRef
      onNodeClicked={on_tree_node_clicked}
      beforeDrop={before_drop}
      getAllowedDropPositions={get_allowed_drop_positions}
      onSetTreeRoot={on_set_tree_root_click}
      onDeleteNode={on_delete_node_click}
    />
    <NodeEditor
      editor_locked={save_in_flight}
      {editor_mode}
      {selectedNode}
      {selected_path_resolved}
      {selected_is_root}
      bind:list_count_draft
      {count_input_invalid}
      onNameDevChange={update_name_dev}
      onListNameChange={update_list_name}
      onListCountChange={update_list_count_expected}
      onInputFieldFocus={on_input_field_focus}
      onAddShlokaChild={() => append_child('shloka')}
      onAddListChild={() => append_child('list')}
      onConvertToList={convert_selected_to_list}
      onConvertToShloka={convert_selected_to_shloka}
    />
  </div>

  <Card.Root class="flex flex-col overflow-hidden">
    <div
      class="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5"
    >
      <div class="min-w-0">
        <span class="text-sm font-semibold">
          {delete_edit_mode ? 'Deletion impact' : order_edit_mode ? 'Order changes' : 'Changes'}
        </span>
        <span class="ml-2 text-xs text-muted-foreground">
          {#if delete_edit_mode}
            {#if delete_dirty}
              {delete_review_state.terminalPaths.length} terminal path{delete_review_state
                .terminalPaths.length === 1
                ? ''
                : 's'}
            {:else}
              no nodes marked for deletion
            {/if}
          {:else if order_edit_mode}
            {#if order_dirty}
              {pending_swaps.length} swap{pending_swaps.length === 1 ? '' : 's'} pending
            {:else}
              no changes yet
            {/if}
          {:else if metadata_dirty}
            {diffState.rows.length} update{diffState.rows.length === 1 ? '' : 's'}
          {:else}
            no unsaved changes
          {/if}
        </span>
      </div>
      {#if delete_edit_mode ? delete_dirty : order_edit_mode ? order_dirty : metadata_dirty}
        <div
          class="size-2 shrink-0 animate-pulse rounded-full {delete_edit_mode
            ? 'bg-destructive'
            : 'bg-primary'}"
        ></div>
      {/if}
    </div>
    <Card.Content class="min-h-0 px-4 py-3">
      <ChangesPanel
        {editor_mode}
        {order_dirty}
        {metadata_dirty}
        {delete_dirty}
        {active_diff_state}
        {pending_swaps}
        {diffState}
        {workingMap}
        {project_id}
        delete_review_rows={delete_review_state.rows}
      />
    </Card.Content>
  </Card.Root>
</div>

<SaveReviewDialog
  bind:open={save_review_open}
  mode={save_review_mode}
  {order_dirty}
  {metadata_dirty}
  {delete_dirty}
  {active_diff_state}
  {pending_swaps}
  {diffState}
  {workingMap}
  {project_id}
  delete_review_rows={delete_review_state.rows}
  terminal_deleted_count={delete_review_state.terminalPaths.length}
  saving={save_in_flight}
  onConfirm={() =>
    save_review_mode === 'delete'
      ? confirm_save_delete()
      : save_review_mode === 'order'
        ? confirm_save_order()
        : confirm_save()}
/>

<AlertDialog.Root bind:open={discard_dialog_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard unsaved edits?</AlertDialog.Title>
      <AlertDialog.Description>
        {diffState.changedNodeCount} changed node(s) will be reverted to the last saved map.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
      <Button variant="destructive" onclick={confirm_discard}>Discard</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={discard_order_dialog_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Cancel order edit?</AlertDialog.Title>
      <AlertDialog.Description>
        {pending_swaps.length} pending swap(s) and tree order changes will be discarded. Field edits from
        before this session are unchanged.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Keep editing order</AlertDialog.Cancel>
      <Button variant="destructive" onclick={confirm_cancel_order_edit}>Cancel order edit</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={discard_delete_dialog_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Cancel delete mode?</AlertDialog.Title>
      <AlertDialog.Description>
        {delete_review_state.deletedRoots.length} deleted branch(es) and {delete_review_state
          .terminalPaths.length} terminal path(s) will be restored in the editor. Nothing is removed from
        the server until you save.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Keep deleting</AlertDialog.Cancel>
      <Button variant="destructive" onclick={confirm_cancel_delete_edit}>Discard deletions</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
