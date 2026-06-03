<script lang="ts">
  import './map_edit_tree.css';
  import { TreePine, Ban, GripVertical, FolderRoot } from '@lucide/svelte';
  import { Tree } from '@keenmate/svelte-treeview';
  import type { Tree as TreeComponent, LTreeNode, DropPosition } from '@keenmate/svelte-treeview';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import * as ScrollArea from '$lib/components/ui/scroll-area';
  import type { MapNodeWithClientId, MapTreeItem } from './map_edit_lib';

  let {
    workingMap,
    treeData,
    editor_locked,
    order_edit_mode,
    order_root_awaiting,
    order_root_selected,
    order_root_resolved,
    base_path_resolved,
    treeRef = $bindable(),
    onNodeClicked,
    beforeDrop,
    getAllowedDropPositions,
    onSetTreeRoot
  }: {
    workingMap: MapNodeWithClientId | null;
    treeData: MapTreeItem[];
    editor_locked: boolean;
    order_edit_mode: boolean;
    order_root_awaiting: boolean;
    order_root_selected: boolean;
    order_root_resolved: string;
    base_path_resolved: string;
    treeRef?: TreeComponent<MapTreeItem> | undefined;
    onNodeClicked: (node: LTreeNode<MapTreeItem>) => void;
    beforeDrop?: (
      dropNode: LTreeNode<MapTreeItem> | null,
      draggedNode: LTreeNode<MapTreeItem>,
      position: DropPosition
    ) => boolean | Promise<boolean>;
    getAllowedDropPositions?: (node: LTreeNode<MapTreeItem>) => DropPosition[];
    onSetTreeRoot: (e: MouseEvent, subtreePath: string) => void;
  } = $props();
</script>

<Card.Root class="flex min-h-[420px] flex-col overflow-hidden lg:min-h-[min(72vh,640px)]">
  <div class="border-b border-border/60 bg-muted/20 px-5 py-3">
    <div class="flex items-center gap-2">
      <TreePine class="size-4 shrink-0 text-muted-foreground" />
      <span class="text-sm font-semibold">Tree</span>
    </div>
    <p class="mt-0.5 text-xs text-muted-foreground">
      {#if order_root_awaiting}
        Click a list with at least two children to choose the reorder root.
      {:else if order_root_selected}
        Reorder direct children under {order_root_resolved}
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
            dragDropMode={order_root_selected && !editor_locked ? 'self' : 'none'}
            allowedDropPositionsMember="allowedDropPositions"
            getAllowedDropPositionsCallback={order_root_selected && !editor_locked
              ? getAllowedDropPositions
              : undefined}
            beforeDropCallback={beforeDrop}
            {onNodeClicked}
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
                class:cursor-pointer={!editor_locked &&
                  order_root_awaiting &&
                  row.nodeType === 'list' &&
                  row.childCount >= 2}
                data-node-kind={nodeKind}
              >
                {#if order_root_selected}
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
                {:else if order_root_awaiting}
                  {#if row.nodeType === 'list' && row.childCount >= 2}
                    <span class="w-5 shrink-0 text-[11px] text-primary tabular-nums">
                      {row.visibleIndex || ''}{row.visibleIndex ? '.' : ''}
                    </span>
                  {:else if !row.isRoot}
                    <span class="w-5 shrink-0" aria-hidden="true"></span>
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
                  {#if order_root_awaiting && row.nodeType === 'list' && row.childCount >= 2}
                    <Badge variant="outline" class="border-primary/30 text-[10px] text-primary"
                      >select</Badge
                    >
                  {/if}
                  {#if !order_edit_mode && row.nodeType === 'list' && row.childCount > 0 && !row.isRoot}
                    <button
                      type="button"
                      class="map-edit-set-root-btn invisible shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      title="Set as tree root"
                      aria-label="Set as tree root"
                      onclick={(e) => onSetTreeRoot(e, row.path)}
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
