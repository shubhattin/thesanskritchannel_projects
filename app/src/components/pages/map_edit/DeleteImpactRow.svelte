<script lang="ts">
  import { client_q } from '~/api/client';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Table from '$lib/components/ui/table';
  import type { DeleteReviewRow } from './map_edit_lib';
  import { map_path_to_db_path } from './map_edit_lib';

  let {
    project_id,
    row,
    compact = false
  }: {
    project_id: number;
    row: DeleteReviewRow;
    compact?: boolean;
  } = $props();

  const db_path = $derived(map_path_to_db_path(row.path));

  const counts_q = $derived(
    client_q.project.map_edit.get_delete_node_resource_counts.query({
      project_id,
      path: db_path
    })
  );
</script>

<Table.Row>
  <Table.Cell class={compact ? 'px-2 py-1.5 font-mono text-[11px]' : 'font-mono text-xs'}>
    {row.pathLabel}
  </Table.Cell>
  <Table.Cell class="max-w-0 px-2 py-1.5">
    <span class="block truncate" title={row.resolvedLabel}>{row.resolvedLabel}</span>
  </Table.Cell>
  {#if $counts_q.isPending}
    <Table.Cell colspan={4} class={compact ? 'px-2 py-1.5' : ''}>
      <Skeleton class="h-4 w-full max-w-xs" />
    </Table.Cell>
  {:else if $counts_q.isError}
    <Table.Cell colspan={4} class="text-destructive {compact ? 'px-2 py-1.5 text-xs' : ''}">
      {$counts_q.error.message || 'Failed to load counts'}
    </Table.Cell>
  {:else if $counts_q.data}
    <Table.Cell class="text-right tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {$counts_q.data.texts}
    </Table.Cell>
    <Table.Cell class="text-right tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {$counts_q.data.translations}
    </Table.Cell>
    <Table.Cell class="text-right tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {$counts_q.data.media_attachment}
    </Table.Cell>
    <Table.Cell class="text-right font-medium tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {$counts_q.data.total}
    </Table.Cell>
  {/if}
</Table.Row>
