<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { MapEditDiffState, MapNodeWithClientId } from './map_edit_lib';
  import MapEditPathLabel from './EditPathLabel.svelte';
  import type { PathSwapEdit } from '~/server/map_path_swap';

  let {
    order_edit_mode,
    order_dirty,
    metadata_dirty,
    active_diff_state,
    pending_swaps,
    diffState,
    workingMap
  }: {
    order_edit_mode: boolean;
    order_dirty: boolean;
    metadata_dirty: boolean;
    active_diff_state: MapEditDiffState;
    pending_swaps: PathSwapEdit[];
    diffState: MapEditDiffState;
    workingMap: MapNodeWithClientId | null;
  } = $props();
</script>

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
