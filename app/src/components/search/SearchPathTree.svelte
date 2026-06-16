<script lang="ts">
  import '../pages/map_edit/map_edit_tree.css';
  import '@keenmate/svelte-treeview/styles.css';
  import { createQuery } from '@tanstack/svelte-query';
  import { TreePine } from '@lucide/svelte';
  import { Tree } from '@keenmate/svelte-treeview';
  import type { LTreeNode } from '@keenmate/svelte-treeview';
  import { client } from '~/api/client';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import {
    build_tree_rows,
    clone_map_with_client_ids,
    collapse_tree_expanded_paths,
    default_tree_expanded_paths,
    expand_tree_expanded_paths,
    type MapNodeWithClientId,
    type MapTreeItem
  } from '~/components/pages/map_edit/map_edit_lib';

  let {
    project_id,
    checked_paths = $bindable(new Set<string>()),
    expanded_paths = $bindable(default_tree_expanded_paths()),
    embedded = false
  }: {
    project_id: number;
    checked_paths?: Set<string>;
    expanded_paths?: Set<string>;
    embedded?: boolean;
  } = $props();

  let working_map = $state<MapNodeWithClientId | null>(null);

  const project_map_q = createQuery(() => ({
    queryKey: ['project_map', project_id],
    queryFn: () => client.project.get_project_map.query({ project_id }),
    enabled: project_id > 0
  }));

  $effect(() => {
    const map = project_map_q.data;
    if (!map) {
      working_map = null;
      return;
    }
    working_map = clone_map_with_client_ids(map, null, 0, new Map());
  });

  const tree_data = $derived.by((): MapTreeItem[] => {
    if (!working_map) return [];
    return build_tree_rows(working_map, [], new Map(), [], false, expanded_paths).filter(
      (row) => !row.isRoot
    );
  });

  const has_selectable_sections = $derived(tree_data.length > 0);

  const has_checked_ancestor = (relPath: string): boolean => {
    if (relPath === '') return false;
    const parts = relPath.split('.');
    for (let i = 1; i < parts.length; i++) {
      if (checked_paths.has(parts.slice(0, i).join('.'))) return true;
    }
    return false;
  };

  const toggle_path_checked = (relPath: string, checked: boolean) => {
    const next = new Set(checked_paths);
    if (checked) next.add(relPath);
    else next.delete(relPath);
    checked_paths = next;
  };

  const toggle_tree_path_expanded = (relPath: string) => {
    expanded_paths = expanded_paths.has(relPath)
      ? collapse_tree_expanded_paths(expanded_paths, relPath)
      : expand_tree_expanded_paths(expanded_paths, relPath);
  };
</script>

{#if embedded}
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="shrink-0 border-b border-border/60 bg-muted/20 px-4 py-3 pe-12">
      <div class="flex items-center gap-2">
        <TreePine class="size-4 shrink-0 text-muted-foreground" />
        <span class="text-sm font-semibold">Sections</span>
      </div>
      {#if has_selectable_sections}
        <p class="mt-0.5 text-xs text-muted-foreground">
          Check sections to limit search. Double-click a list to expand or collapse. Leave unchecked
          to search the entire text.
        </p>
      {/if}
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
      {#if project_map_q.isPending}
        <Skeleton class="mx-1 h-[200px] w-[calc(100%-0.5rem)]" />
      {:else if project_map_q.isError}
        <p class="px-2 py-4 text-sm text-destructive">Failed to load text structure.</p>
      {:else if !has_selectable_sections}
        <p class="px-4 py-10 text-center text-sm leading-relaxed text-muted-foreground">
          This is a single-level text. There are no sections to filter — search covers the entire
          text at <span class="font-mono">/</span>.
        </p>
      {:else}
        <div class="map-edit-tree px-1 pb-2">
          {@render tree_content()}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="flex min-h-[280px] flex-col overflow-hidden rounded-lg border">
    <div class="shrink-0 border-b border-border/60 bg-muted/20 px-4 py-3">
      <div class="flex items-center gap-2">
        <TreePine class="size-4 shrink-0 text-muted-foreground" />
        <span class="text-sm font-semibold">Sections</span>
      </div>
      {#if has_selectable_sections}
        <p class="mt-0.5 text-xs text-muted-foreground">
          Check sections to limit search. Double-click a list to expand or collapse. Leave unchecked
          to search the entire text.
        </p>
      {/if}
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
      {#if project_map_q.isPending}
        <Skeleton class="mx-2 h-[200px] w-[calc(100%-1rem)]" />
      {:else if project_map_q.isError}
        <p class="px-2 py-4 text-sm text-destructive">Failed to load text structure.</p>
      {:else if !has_selectable_sections}
        <p class="px-4 py-10 text-center text-sm leading-relaxed text-muted-foreground">
          This is a single-level text. There are no sections to filter — search covers the entire
          text at <span class="font-mono">/</span>.
        </p>
      {:else}
        <div class="map-edit-tree px-1 pb-2">
          {@render tree_content()}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#snippet tree_content()}
  <Tree
    data={tree_data}
    idMember="id"
    pathMember="path"
    parentPathMember="parentPath"
    levelMember="level"
    displayValueMember="name_dev"
    orderMember="sortOrder"
    isSelectedMember="isSelected"
    isExpandedMember="isExpanded"
    shouldToggleOnNodeClick={false}
    dragDropMode="none"
  >
    {#snippet nodeTemplate(node: LTreeNode<MapTreeItem>)}
      {@const row = node.data!}
      {@const relPath = row.path}
      {@const blocked = has_checked_ancestor(relPath)}
      {@const is_checked = checked_paths.has(relPath)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="map-edit-tree-row flex w-full items-center gap-2 py-1 pr-2"
        data-node-kind={row.nodeType === 'shloka' ? 'leaf' : 'list'}
        ondblclick={() => {
          if (!row.isLeaf && row.childCount > 0) toggle_tree_path_expanded(relPath);
        }}
      >
        <Checkbox
          checked={is_checked}
          disabled={blocked}
          onCheckedChange={(v) => toggle_path_checked(relPath, v === true)}
          onclick={(e) => e.stopPropagation()}
        />
        <span class="truncate text-sm">{row.name_dev}</span>
      </div>
    {/snippet}
  </Tree>
{/snippet}
