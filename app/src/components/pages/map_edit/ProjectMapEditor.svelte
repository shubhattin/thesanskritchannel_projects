<script lang="ts">
  import './map_edit_tree.css';
  import {
    Map as MapIcon,
    TreePine,
    PenLine,
    ArrowUpDown,
    Ban,
    GripVertical,
    FolderRoot
  } from '@lucide/svelte';
  import { Tree } from '@keenmate/svelte-treeview';
  import type { Tree as TreeComponent, LTreeNode, DropPosition } from '@keenmate/svelte-treeview';
  import { browser } from '$app/environment';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { client_q } from '~/api/client';
  import {
    invalidate_project_map_queries,
    invalidate_project_registry_queries,
    project_map_q
  } from '~/state/main_app/data.svelte';
  import { map_edit_dirty } from '~/state/map_edit_dirty.svelte';
  import type { recursive_list_type } from '~/state/data_types';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import * as ScrollArea from '$lib/components/ui/scroll-area';
  import * as Breadcrumb from '$lib/components/ui/breadcrumb';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Separator } from '$lib/components/ui/separator';
  import { Switch } from '$lib/components/ui/switch';
  import { toast } from 'svelte-sonner';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import {
    type MapNodeWithClientId,
    type MapPath,
    type BaselineNodeSnapshot,
    clone_map_with_client_ids,
    strip_client_ids,
    parse_path_query,
    format_path_query,
    is_path_valid,
    build_tree_rows,
    compute_map_edit_diff,
    get_node_at_map_path,
    get_parent_context,
    full_path_from_subtree_path,
    reorder_siblings,
    get_breadcrumb_segments,
    parse_optional_count,
    map_path_to_db_path,
    clone_baseline_snapshots,
    clone_working_map,
    clone_recursive_list,
    MAP_EDIT_CLIENT_ID,
    format_path_resolved_label,
    default_tree_expanded_paths,
    expand_tree_expanded_paths,
    collapse_tree_expanded_paths
  } from './map_edit_lib';
  import MapEditPathLabel from './MapEditPathLabel.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { PathSwapEdit } from '~/server/map_path_swap';

  let {
    project_id,
    project_name_dev
  }: {
    project_id: number;
    project_name_dev: string;
  } = $props();

  let baselineMap = $state<recursive_list_type | null>(null);
  let workingMap = $state<MapNodeWithClientId | null>(null);
  let baselineSnapshots = $state<Map<string, BaselineNodeSnapshot>>(new Map());
  let selectedNodePath = $state<MapPath>([]);
  let basePath = $state<MapPath>([]);
  let save_dialog_open = $state(false);
  let discard_dialog_open = $state(false);
  let save_order_dialog_open = $state(false);
  let discard_order_dialog_open = $state(false);
  let order_edit_mode = $state(false);
  let order_entry_map = $state<MapNodeWithClientId | null>(null);
  let order_entry_snapshots = $state<Map<string, BaselineNodeSnapshot>>(new Map());
  let pending_swaps = $state<PathSwapEdit[]>([]);
  let count_input_invalid = $state(false);
  let treeRef = $state<TreeComponent<MapTreeItem> | undefined>(undefined);
  let saving_order = $state(false);
  let typing_enabled = $state(true);
  let last_tree_click = $state<{ path: string; at: number } | null>(null);
  let expandedTreePaths = $state<Set<string>>(default_tree_expanded_paths());

  const TREE_DBLCLICK_MS = 400;

  const typing_ctx = $derived(
    createTypingContext('Devanagari', {
      includeInherentVowel: true
    })
  );

  $effect(() => {
    typing_ctx.ready;
  });

  type MapTreeItem = {
    path: string;
    id: string;
    name_dev: string;
    level: number;
    parentPath: string;
    sortOrder: number;
    visibleIndex: number;
    isRoot: boolean;
    isLeaf: boolean;
    nodeType: 'list' | 'shloka';
    childCount: number;
    edited: boolean;
    moved: boolean;
    draggable: boolean;
    isSelected: boolean;
    isExpanded: boolean;
    allowedDropPositions: ('above' | 'below')[];
  };

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

  const active_diff_state = $derived(order_edit_mode ? order_diff_state : diffState);
  const order_dirty = $derived(
    order_edit_mode && (pending_swaps.length > 0 || order_diff_state.dirty)
  );
  const metadata_dirty = $derived(!order_edit_mode && diffState.dirty);
  const metadata_field_dirty = $derived.by(() => {
    if (!workingMap || order_edit_mode) return false;
    return compute_map_edit_diff(workingMap, baselineSnapshots, {
      kinds: ['rename', 'list_name_change', 'expected_count_change']
    }).dirty;
  });

  const treeData = $derived.by((): MapTreeItem[] => {
    if (!workingMap) return [];
    return build_tree_rows(
      workingMap,
      basePath,
      active_diff_state.flagsByClientId,
      untrack(() => selectedNodePath),
      order_edit_mode,
      expandedTreePaths
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

  let list_count_draft = $state('');

  $effect(() => {
    const dirty = metadata_dirty || order_dirty;
    if (get(map_edit_dirty) !== dirty) map_edit_dirty.set(dirty);
  });

  let last_synced_map_key = '';

  $effect(() => {
    const map = $project_map_q.data;
    if (!map || metadata_dirty || order_dirty) return;
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

  const save_mut = client_q.project.map_edit.update.mutation({
    onSuccess: async (_data, variables) => {
      save_dialog_open = false;
      save_order_dialog_open = false;
      order_edit_mode = false;
      order_entry_map = null;
      pending_swaps = [];
      await invalidate_project_registry_queries(project_id);
      await invalidate_project_map_queries(project_id);
      last_synced_map_key = JSON.stringify(variables.map);
      reset_from_server(variables.map);
      toast.success(saving_order ? 'List order saved' : 'Project map saved');
      saving_order = false;
    },
    onError: (err) => {
      saving_order = false;
      toast.error(err.message || 'Failed to save project map');
    }
  });

  const save_order_indexes_mut = client_q.project.map_edit.update_indexes.mutation({
    onError: (err) => {
      toast.error(err.message || 'Failed to update path indexes');
    }
  });

  function reset_from_server(map: recursive_list_type) {
    const snapshots = new Map<string, BaselineNodeSnapshot>();
    const plain = clone_recursive_list(map);
    baselineMap = plain;
    workingMap = clone_map_with_client_ids(plain, null, 0, snapshots);
    baselineSnapshots = snapshots;
    const fromUrl = parse_path_query(page.url.searchParams.get('path'));
    basePath = is_path_valid(workingMap, fromUrl) ? fromUrl : [];
    if (!is_path_valid(workingMap, fromUrl) && fromUrl.length > 0) {
      sync_path_query([]);
    } else {
      sync_path_query(basePath);
    }
    selectedNodePath = basePath.length ? [...basePath] : [];
    expandedTreePaths = default_tree_expanded_paths();
  }

  function reset_tree_expansion() {
    expandedTreePaths = default_tree_expanded_paths();
  }

  function bump_working() {
    if (!workingMap) return;
    workingMap = clone_working_map(workingMap);
  }

  function sync_path_query(path: MapPath) {
    const url = new URL(page.url);
    const next = format_path_query(path);
    const current = url.searchParams.get('path') ?? '';
    if (current === next || (!current && !next)) return;
    if (next) url.searchParams.set('path', next);
    else url.searchParams.delete('path');
    const search = url.searchParams.toString();
    goto(`${url.pathname}${search ? `?${search}` : ''}`, {
      replaceState: true,
      keepFocus: true,
      noScroll: true
    });
  }

  function select_node_by_subtree_path(subtreePath: string) {
    if (!workingMap) return;
    const full = full_path_from_subtree_path(basePath, subtreePath);
    if (!get_node_at_map_path(workingMap, full)) return;
    selectedNodePath = full;
  }

  function set_base_path(path: MapPath) {
    if (!workingMap || !is_path_valid(workingMap, path)) return;
    basePath = path;
    sync_path_query(path);
    if (!is_path_valid(workingMap, selectedNodePath)) {
      selectedNodePath = path.length === 0 ? [] : path;
    }
    reset_tree_expansion();
  }

  function promote_change_root(subtreePath: string) {
    if (!workingMap) return;
    const full = full_path_from_subtree_path(basePath, subtreePath);
    if (!get_node_at_map_path(workingMap, full)) return;
    basePath = full;
    sync_path_query(full);
    selectedNodePath = full;
    reset_tree_expansion();
  }

  function toggle_tree_path_expanded(relPath: string) {
    expandedTreePaths = expandedTreePaths.has(relPath)
      ? collapse_tree_expanded_paths(expandedTreePaths, relPath)
      : expand_tree_expanded_paths(expandedTreePaths, relPath);
  }

  function on_tree_node_clicked(node: LTreeNode<MapTreeItem>) {
    if (order_edit_mode) return;
    const row = node.data;
    if (!row) return;

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
    promote_change_root(subtreePath);
  }

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }

  function update_name_dev(value: string) {
    if (!selectedNode || selected_is_root) return;
    selectedNode.name_dev = value;
    bump_working();
  }

  function update_list_name(value: string) {
    if (!selectedNode || selectedNode.info.type !== 'list') return;
    selectedNode.info = { ...selectedNode.info, list_name: value };
    bump_working();
  }

  function update_list_count_expected(raw: string) {
    if (!selectedNode || selectedNode.info.type !== 'list') return;
    const parsed = parse_optional_count(raw);
    if (parsed === 'invalid') {
      count_input_invalid = true;
      return;
    }
    count_input_invalid = false;
    selectedNode.info = { ...selectedNode.info, list_count_expected: parsed };
    bump_working();
  }

  async function before_drop(
    dropNode: LTreeNode<MapTreeItem> | null,
    draggedNode: LTreeNode<MapTreeItem>,
    position: DropPosition
  ) {
    if (!workingMap || position === 'child' || !dropNode?.path) return false;

    const draggedFull = full_path_from_subtree_path(basePath, draggedNode.path);
    const targetFull = full_path_from_subtree_path(basePath, dropNode.path);
    if (draggedFull.length === 0) return false;

    const draggedCtx = get_parent_context(workingMap, draggedFull);
    const targetCtx = get_parent_context(workingMap, targetFull);
    if (!draggedCtx || !targetCtx) return false;
    if (draggedCtx.parent[MAP_EDIT_CLIENT_ID] !== targetCtx.parent[MAP_EDIT_CLIENT_ID]) {
      return false;
    }

    let toIndex = targetCtx.index;
    if (position === 'below') toIndex += 1;
    if (draggedCtx.index < toIndex) toIndex -= 1;

    if (draggedCtx.index !== toIndex) {
      record_pending_swap(draggedCtx.parentPath, draggedCtx.index, toIndex);
    }

    const ok = reorder_siblings(workingMap, draggedCtx.parentPath, draggedCtx.index, toIndex);
    if (ok) bump_working();
    return false;
  }

  function record_pending_swap(parentPath: MapPath, from_index: number, to_index: number) {
    const path_a = map_path_to_db_path([...parentPath, from_index + 1]);
    const path_b = map_path_to_db_path([...parentPath, to_index + 1]);
    pending_swaps = [...pending_swaps, { swap_paths: [path_a, path_b] }];
  }

  function enter_order_edit_mode() {
    if (!workingMap || order_edit_mode) return;
    if (metadata_field_dirty) {
      toast.error('Save or discard field edits before changing order');
      return;
    }
    order_entry_map = clone_working_map(workingMap);
    order_entry_snapshots = clone_baseline_snapshots(baselineSnapshots);
    pending_swaps = [];
    order_edit_mode = true;
  }

  function cancel_order_edit() {
    if (!order_edit_mode) return;
    if (!order_dirty) {
      order_edit_mode = false;
      order_entry_map = null;
      pending_swaps = [];
      return;
    }
    discard_order_dialog_open = true;
  }

  function confirm_cancel_order_edit() {
    if (order_entry_map) {
      workingMap = clone_working_map(order_entry_map);
      baselineSnapshots = clone_baseline_snapshots(order_entry_snapshots);
    }
    pending_swaps = [];
    order_edit_mode = false;
    order_entry_map = null;
    discard_order_dialog_open = false;
    map_edit_dirty.set(false);
  }

  function request_save_order() {
    if (!order_dirty) return;
    save_order_dialog_open = true;
  }

  async function confirm_save_order() {
    if (!workingMap || $save_mut.isPending || $save_order_indexes_mut.isPending) return;
    save_order_dialog_open = false;
    saving_order = true;
    try {
      if (pending_swaps.length > 0) {
        await $save_order_indexes_mut.mutateAsync({
          project_id,
          edits: pending_swaps
        });
      }
      await $save_mut.mutateAsync({
        project_id,
        map: strip_client_ids(workingMap)
      });
    } catch {
      saving_order = false;
    }
  }

  function get_allowed_drop_positions(node: LTreeNode<MapTreeItem>) {
    if (!node.data?.draggable) return [] as DropPosition[];
    return ['above', 'below'] as DropPosition[];
  }

  function request_save() {
    if (order_edit_mode || !diffState.dirty || count_input_invalid) return;
    save_dialog_open = true;
  }

  function confirm_save() {
    if (!workingMap || $save_mut.isPending) return;
    $save_mut.mutate({
      project_id,
      map: strip_client_ids(workingMap)
    });
  }

  function request_cancel() {
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
    count_input_invalid = false;
    map_edit_dirty.set(false);
  }

  function confirm_discard() {
    restore_from_baseline();
    discard_dialog_open = false;
  }

  let leave_confirmed = false;
  onMount(() => {
    if (!browser) return;
    const on_beforeunload = (e: BeforeUnloadEvent) => {
      if (get(map_edit_dirty)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', on_beforeunload);
    return () => window.removeEventListener('beforeunload', on_beforeunload);
  });

  onDestroy(() => {
    map_edit_dirty.set(false);
  });

  beforeNavigate(({ cancel }) => {
    if ((!metadata_dirty && !order_dirty) || leave_confirmed) return;
    const message = order_dirty
      ? 'You have unsaved order changes. Leave this page and discard them?'
      : 'You have unsaved map edits. Leave this page and discard them?';
    const ok = confirm(message);
    if (!ok) cancel();
    else leave_confirmed = true;
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
            {#if order_edit_mode}
              <ArrowUpDown class="size-4" />
            {:else}
              <MapIcon class="size-4" />
            {/if}
          </div>
          <div class="space-y-0.5">
            <Card.Title class="text-base">
              {order_edit_mode ? 'Edit list order' : 'Edit project map'}
            </Card.Title>
            <Card.Description class="text-sm">{project_name_dev}</Card.Description>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          {#if order_edit_mode && order_dirty}
            <Badge variant="secondary" class="tabular-nums">
              {pending_swaps.length} swap{pending_swaps.length === 1 ? '' : 's'}
            </Badge>
          {:else if metadata_dirty}
            <Badge variant="secondary" class="tabular-nums"
              >{diffState.changedNodeCount} changed</Badge
            >
          {/if}
          {#if order_edit_mode}
            <Button variant="outline" size="sm" onclick={cancel_order_edit}
              >Cancel order edit</Button
            >
            <Button
              size="sm"
              onclick={request_save_order}
              disabled={!order_dirty || $save_mut.isPending || $save_order_indexes_mut.isPending}
            >
              {$save_mut.isPending || $save_order_indexes_mut.isPending
                ? 'Saving…'
                : 'Save current order'}
            </Button>
          {:else}
            <Button variant="outline" size="sm" onclick={request_cancel}>Cancel</Button>
            <Button
              size="sm"
              onclick={request_save}
              disabled={!metadata_dirty || $save_mut.isPending || count_input_invalid}
            >
              {$save_mut.isPending ? 'Saving…' : 'Save'}
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

      {#if order_edit_mode}
        <div class="rounded-md bg-amber-500/8 px-3 py-1.5 dark:bg-amber-400/8">
          <p class="text-xs text-amber-800 dark:text-amber-300">
            Order edit mode — drag siblings to reorder. Field edits are locked.
          </p>
        </div>
      {/if}
    </Card.Header>
  </Card.Root>

  {#if !order_edit_mode}
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex size-5 shrink-0 items-center justify-center rounded text-primary opacity-70"
        >
          <PenLine class="size-3.5" />
        </div>
        <p class="text-xs text-muted-foreground">
          Lipi-Lekhika typing for <span class="font-medium text-foreground">Name (Devanagari)</span>
          — toggle with
          <kbd
            class="rounded border border-border bg-background px-1.5 font-mono text-[10px] shadow-sm"
            >Alt+X</kbd
          >
          or
          <kbd
            class="rounded border border-border bg-background px-1.5 font-mono text-[10px] shadow-sm"
            >Alt+C</kbd
          >
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Label
          for="map-edit-typing"
          class="cursor-pointer text-xs font-medium text-muted-foreground select-none"
        >
          Typing
        </Label>
        <Switch
          id="map-edit-typing"
          checked={typing_enabled}
          onCheckedChange={(v) => (typing_enabled = v)}
          title="Devanagari transliteration typing (Alt+X / Alt+C)"
        />
      </div>
    </div>
  {/if}

  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
    <Card.Root class="flex min-h-[420px] flex-col overflow-hidden lg:min-h-[min(72vh,640px)]">
      <div class="border-b border-border/60 bg-muted/20 px-5 py-3">
        <div class="flex items-center gap-2">
          <TreePine class="size-4 shrink-0 text-muted-foreground" />
          <span class="text-sm font-semibold">Tree</span>
        </div>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {#if order_edit_mode}
            Drag rows to reorder siblings — subtree under {base_path_resolved}
          {:else}
            Subtree under {base_path_resolved}
          {/if}
        </p>
      </div>
      <Card.Content class="min-h-0 flex-1 px-3 pt-3 pb-4">
        <ScrollArea.Root class="h-[min(52vh,420px)] lg:h-[min(60vh,560px)]">
          {#if workingMap && treeData.length > 0}
            <div class="map-edit-tree px-1">
              <Tree
                bind:this={treeRef}
                data={treeData}
                idMember="id"
                pathMember="path"
                parentPathMember="parentPath"
                levelMember="level"
                displayValueMember="name_dev"
                orderMember="sortOrder"
                isSelectedMember="isSelected"
                isExpandedMember="isExpanded"
                shouldToggleOnNodeClick={false}
                dragDropMode={order_edit_mode ? 'self' : 'none'}
                allowedDropPositionsMember="allowedDropPositions"
                getAllowedDropPositionsCallback={order_edit_mode
                  ? get_allowed_drop_positions
                  : undefined}
                beforeDropCallback={order_edit_mode ? before_drop : undefined}
                onNodeClicked={on_tree_node_clicked}
              >
                {#snippet nodeTemplate(node: LTreeNode<MapTreeItem>)}
                  {@const row = node.data!}
                  {@const nodeKind = order_edit_mode
                    ? 'neutral'
                    : row.nodeType === 'shloka'
                      ? 'leaf'
                      : row.childCount === 0
                        ? 'empty-list'
                        : 'list'}
                  <div
                    class="map-edit-tree-row group flex w-full items-center gap-2 py-1 pr-2"
                    class:map-edit-row-selected={row.isSelected}
                    data-node-kind={nodeKind}
                  >
                    {#if order_edit_mode}
                      {#if row.draggable}
                        <span
                          class="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                          title="Drag to reorder"
                        >
                          <GripVertical class="size-3.5" />
                        </span>
                        <span class="w-5 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {row.visibleIndex}.
                        </span>
                      {:else if !row.isRoot}
                        <span class="w-8 shrink-0" aria-hidden="true"></span>
                      {/if}
                    {:else if !row.isRoot}
                      {#if row.nodeType === 'list' && row.childCount === 0}
                        <span
                          class="shrink-0 text-red-400 dark:text-red-500"
                          title="Empty list — no children"
                        >
                          <Ban class="size-3" />
                        </span>
                      {/if}
                      <span class="w-5 shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
                        {row.visibleIndex}.
                      </span>
                    {/if}
                    <span
                      class="min-w-0 flex-1 truncate text-sm {row.nodeType === 'list' &&
                      row.childCount === 0 &&
                      !row.isRoot &&
                      !order_edit_mode
                        ? 'opacity-60'
                        : ''}">{row.name_dev}</span
                    >
                    <div class="flex shrink-0 items-center gap-1">
                      {#if !order_edit_mode &&
                        row.nodeType === 'list' &&
                        row.childCount > 0 &&
                        !row.isRoot}
                        <button
                          type="button"
                          class="map-edit-set-root-btn invisible shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                          title="Set as tree root"
                          aria-label="Set as tree root"
                          onclick={(e) => on_set_tree_root_click(e, row.path)}
                        >
                          <FolderRoot class="size-3.5" />
                        </button>
                      {/if}
                      {#if row.isRoot}
                        <Badge variant="outline" class="border-primary/30 text-[10px] text-primary"
                          >root</Badge
                        >
                      {/if}
                      {#if !order_edit_mode && row.edited}
                        <Badge
                          variant="secondary"
                          class="bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          >edited</Badge
                        >
                      {/if}
                      {#if row.moved}
                        <Badge class="text-[10px]">moved</Badge>
                      {/if}
                    </div>
                  </div>
                {/snippet}
              </Tree>
            </div>
          {:else}
            <p class="p-4 text-sm text-muted-foreground">Loading map…</p>
          {/if}
        </ScrollArea.Root>
      </Card.Content>
    </Card.Root>

    <Card.Root class="flex min-h-[420px] flex-col overflow-hidden lg:min-h-[min(72vh,640px)]">
      <div class="border-b border-border/60 bg-muted/20 px-5 py-3">
        <div class="flex items-center gap-2">
          <PenLine class="size-4 shrink-0 text-muted-foreground" />
          <span class="text-sm font-semibold">Node editor</span>
        </div>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {#if selectedNode}
            <span class="text-foreground">{selected_path_resolved}</span>
          {:else}
            Select a node in the tree
          {/if}
        </p>
      </div>
      <Card.Content class="space-y-4 pt-4">
        {#if order_edit_mode}
          <div class="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
            <p class="text-sm text-muted-foreground">
              {#if selectedNode}
                Viewing <span class="font-medium text-foreground">{selected_path_resolved}</span>.
                Reorder in the tree; names and list labels cannot be edited in this mode.
              {:else}
                Select a node to inspect it. Reorder siblings using drag handles in the tree.
              {/if}
            </p>
          </div>
        {:else if selectedNode}
          <div class="space-y-1.5">
            <Label
              for="name_dev"
              class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >Name (Devanagari)</Label
            >
            <Input
              id="name_dev"
              value={selectedNode.name_dev}
              disabled={selected_is_root}
              onbeforeinput={(e) =>
                handleTypingBeforeInputEvent(
                  typing_ctx,
                  e,
                  (newValue) => update_name_dev(newValue),
                  typing_enabled
                )}
              onblur={() => typing_ctx.clearContext()}
              onkeydown={(e) => {
                if (toggle_typing_from_keyboard(e)) return;
                clearTypingContextOnKeyDown(e, typing_ctx);
              }}
            />
            {#if selected_is_root}
              <p class="text-xs text-muted-foreground">
                Root display name (Devanagari) is not edited here.
              </p>
            {/if}
          </div>

          {#if selectedNode.info.type === 'list'}
            <Separator />
            <div class="space-y-1.5">
              <Label
                for="list_name"
                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >List type label</Label
              >
              <Input
                id="list_name"
                value={selectedNode.info.list_name}
                oninput={(e) => update_list_name(e.currentTarget.value)}
              />
              {#if selected_is_root}
                <p class="text-xs text-muted-foreground">
                  Top-level list type label (e.g. Veda, Kanda). Editable at the project root only.
                </p>
              {/if}
            </div>
            <div class="space-y-1.5">
              <Label
                for="list_count_expected"
                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >Expected list count <span class="font-normal normal-case">(optional)</span></Label
              >
              <Input
                id="list_count_expected"
                inputmode="numeric"
                bind:value={list_count_draft}
                oninput={(e) => update_list_count_expected(e.currentTarget.value)}
                aria-invalid={count_input_invalid}
              />
              {#if count_input_invalid}
                <p class="text-xs text-destructive">Enter a whole number ≥ 0, or leave empty.</p>
              {/if}
            </div>
          {:else}
            <Separator />
            <div class="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
              <p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Shloka metadata
              </p>
              <dl class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <dt class="text-muted-foreground">Shloka count</dt>
                <dd class="font-medium tabular-nums">{selectedNode.info.shloka_count}</dd>
                <dt class="text-muted-foreground">Total lines</dt>
                <dd class="font-medium tabular-nums">{selectedNode.info.total}</dd>
                {#if selectedNode.info.shloka_count_expected != null}
                  <dt class="text-muted-foreground">Expected</dt>
                  <dd class="font-medium tabular-nums">
                    {selectedNode.info.shloka_count_expected}
                  </dd>
                {/if}
              </dl>
              <p class="mt-2 text-xs text-muted-foreground">
                Derived fields update when texts change; not editable here.
              </p>
            </div>
          {/if}
        {:else}
          <div class="flex h-full flex-col items-center justify-center py-8 text-center">
            <div class="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/60">
              <PenLine class="size-4 text-muted-foreground" />
            </div>
            <p class="text-sm text-muted-foreground">
              Choose a node from the tree to edit its fields.
            </p>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>

  <Card.Root class="overflow-hidden">
    <div class="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
      <div>
        <span class="text-sm font-semibold">
          {order_edit_mode ? 'Order changes' : 'Changes'}
        </span>
        <span class="ml-2 text-xs text-muted-foreground">
          {#if order_edit_mode}
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
      {#if order_edit_mode ? order_dirty : metadata_dirty}
        <div class="size-2 animate-pulse rounded-full bg-primary"></div>
      {/if}
    </div>
    <Card.Content class="pt-4 pb-4">
      {#if order_edit_mode}
        {#if active_diff_state.rows.length === 0 && pending_swaps.length === 0}
          <p class="text-sm text-muted-foreground">Drag siblings in the tree to reorder lists.</p>
        {:else if workingMap}
          <Tooltip.Provider>
            <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {#each active_diff_state.rows as row (row.kind + row.clientId + row.summary)}
                <li
                  class="space-y-1 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs leading-snug text-foreground"
                >
                  <MapEditPathLabel map={workingMap} path={row.path} variant="short" />
                  <p>{row.summary}</p>
                </li>
              {/each}
            </ul>
          </Tooltip.Provider>
        {/if}
      {:else if active_diff_state.rows.length === 0}
        <p class="text-sm text-muted-foreground">Edits will appear here.</p>
      {:else if workingMap}
        <Tooltip.Provider>
          <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {#each active_diff_state.rows as row (row.kind + row.clientId + row.summary)}
              <li
                class="space-y-1 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs leading-snug text-foreground"
              >
                <MapEditPathLabel map={workingMap} path={row.path} variant="short" />
                <p>{row.summary}</p>
              </li>
            {/each}
          </ul>
        </Tooltip.Provider>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<AlertDialog.Root bind:open={save_dialog_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Save map changes?</AlertDialog.Title>
      <AlertDialog.Description>
        <ul class="mt-2 list-inside list-disc space-y-1 text-sm">
          <li>{diffState.changedNodeCount} node(s) changed</li>
          <li>{diffState.renameCount} rename(s)</li>
          <li>{diffState.reorderedParentCount} parent list(s) reordered</li>
        </ul>
        <p class="mt-3 text-sm">
          The root name also updates the project display name in the project list.
        </p>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
      <Button onclick={confirm_save} disabled={$save_mut.isPending}>Save</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

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

<AlertDialog.Root bind:open={save_order_dialog_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Save list order?</AlertDialog.Title>
      <AlertDialog.Description>
        <ul class="mt-2 list-inside list-disc space-y-1 text-sm">
          <li>{pending_swaps.length} path swap(s) will update texts, translations, and media</li>
          <li>The project map structure will be saved with the new order</li>
        </ul>
        <p class="mt-3 text-sm">
          This cannot be undone from the editor. Review the order changes below.
        </p>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
      <Button
        onclick={confirm_save_order}
        disabled={$save_mut.isPending || $save_order_indexes_mut.isPending}
      >
        Save current order
      </Button>
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
