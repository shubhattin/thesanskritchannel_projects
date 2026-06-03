<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { PathSwapEdit } from '~/server/map_path_swap';
  import type { MapChangeKind, MapEditDiffState, MapNodeWithClientId } from './map_edit_lib';
  import MapEditPathLabel from './EditPathLabel.svelte';

  let {
    compact = false,
    order_edit_mode,
    order_dirty,
    metadata_dirty,
    active_diff_state,
    pending_swaps,
    diffState,
    workingMap
  }: {
    /** Denser rows for save dialog and tight layouts */
    compact?: boolean;
    order_edit_mode: boolean;
    order_dirty: boolean;
    metadata_dirty: boolean;
    active_diff_state: MapEditDiffState;
    pending_swaps: PathSwapEdit[];
    diffState: MapEditDiffState;
    workingMap: MapNodeWithClientId | null;
  } = $props();

  const kind_labels: Record<MapChangeKind, string> = {
    rename: 'Rename',
    list_name_change: 'Label',
    expected_count_change: 'Count',
    reorder: 'Reorder',
    add_child: 'Add child',
    type_change: 'Convert type'
  };

  const kind_styles: Record<MapChangeKind, string> = {
    rename: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    list_name_change: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    expected_count_change: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
    reorder: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    add_child: 'bg-teal-500/15 text-teal-800 dark:text-teal-200',
    type_change: 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
  };

  const rows = $derived(active_diff_state.rows);
  const is_empty = $derived(
    order_edit_mode ? rows.length === 0 && pending_swaps.length === 0 : rows.length === 0
  );
</script>

{#if is_empty}
  <p class="text-sm text-muted-foreground {compact ? 'py-1 text-xs' : ''}">
    {#if order_edit_mode}
      Drag siblings in the tree to reorder lists.
    {:else}
      Edits will appear here.
    {/if}
  </p>
{:else if workingMap}
  <Tooltip.Provider>
    <ul
      class={compact
        ? 'divide-y divide-border/50 rounded-md border border-border/60'
        : 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3'}
    >
      {#each rows as row (row.kind + row.clientId + row.summary)}
        <li
          class={compact
            ? 'flex min-w-0 flex-col gap-0.5 px-2.5 py-2 sm:flex-row sm:items-start sm:gap-2'
            : 'flex min-w-0 flex-col gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2'}
        >
          <div class="flex min-w-0 shrink-0 flex-wrap items-center gap-1">
            <span
              class="shrink-0 rounded font-semibold tracking-wide uppercase {kind_styles[
                row.kind
              ]} {compact ? 'px-1 py-px text-[9px]' : 'px-1.5 py-0.5 text-[10px]'}"
            >
              {kind_labels[row.kind]}
            </span>
            <MapEditPathLabel map={workingMap} path={row.path} variant="short" />
          </div>
          <p
            class="min-w-0 text-foreground/90 {compact
              ? 'text-xs leading-snug sm:flex-1'
              : 'text-[13px] leading-snug'}"
          >
            {row.summary}
          </p>
        </li>
      {/each}
    </ul>
  </Tooltip.Provider>
{/if}
