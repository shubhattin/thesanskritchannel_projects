<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import * as Table from '$lib/components/ui/table';
  import { useTRPC } from '~/api/client';
  import { map_path_to_db_path, type DeleteReviewRow } from './map_edit_lib';
  import DeleteImpactRow from './DeleteImpactRow.svelte';

  let {
    project_id,
    rows,
    compact = false
  }: {
    project_id: number;
    rows: DeleteReviewRow[];
    compact?: boolean;
  } = $props();

  const db_paths = $derived([...new Set(rows.map((row) => map_path_to_db_path(row.path)))]);
  const trpc = useTRPC();
  const counts_q = createQuery(() =>
    trpc.project.map_edit.get_delete_node_resource_counts.queryOptions({
      project_id,
      paths: db_paths
    })
  );
  const counts_state = $derived(counts_q);
</script>

{#if rows.length === 0}
  <p class="text-sm text-muted-foreground {compact ? 'text-xs' : ''}">
    Click delete icons in the tree to mark nodes for removal.
  </p>
{:else}
  <p
    class="rounded-md border border-destructive/35 bg-destructive/8 px-2.5 py-2 text-xs text-destructive dark:text-red-300 {compact
      ? 'mb-2'
      : 'mb-3'}"
    role="alert"
  >
    All texts, translations, and media listed below will be permanently deleted when you save.
  </p>
  <div class="overflow-x-hidden rounded-md border border-border/60">
    <Table.Root class="table-fixed {compact ? 'text-xs' : 'text-sm'}">
      <colgroup>
        <col class="w-13" />
        <col />
        <col class="w-13" />
        <col class="w-18" />
        <col class="w-13" />
        <col class="w-13" />
      </colgroup>
      <Table.Header>
        <Table.Row>
          <Table.Head class={compact ? 'h-8 px-2' : ''}>Path</Table.Head>
          <Table.Head class={compact ? 'h-8 px-2' : ''}>Label</Table.Head>
          <Table.Head
            class={compact ? 'h-8 px-2 text-right tabular-nums' : 'text-right tabular-nums'}
            >Texts</Table.Head
          >
          <Table.Head
            class={compact ? 'h-8 px-2 text-right tabular-nums' : 'text-right tabular-nums'}
            >Translations</Table.Head
          >
          <Table.Head
            class={compact ? 'h-8 px-2 text-right tabular-nums' : 'text-right tabular-nums'}
            >Media</Table.Head
          >
          <Table.Head
            class={compact ? 'h-8 px-2 text-right tabular-nums' : 'text-right tabular-nums'}
            >Total</Table.Head
          >
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows as row (row.path.join(':'))}
          {@const db_path = map_path_to_db_path(row.path)}
          <DeleteImpactRow
            {row}
            {compact}
            counts={counts_state.data?.[db_path]}
            counts_pending={counts_state.isPending}
            counts_error={counts_state.isError
              ? counts_state.error.message || 'Failed to load counts'
              : ''}
          />
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
