<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Table from '$lib/components/ui/table';
  import type { DeleteReviewRow } from './map_edit_lib';
  import type { ExactPathResourceCounts } from '~/server/map/path-delete-db.server';

  let {
    row,
    compact = false,
    counts,
    counts_pending = false,
    counts_error = ''
  }: {
    row: DeleteReviewRow;
    compact?: boolean;
    counts?: ExactPathResourceCounts;
    counts_pending?: boolean;
    counts_error?: string;
  } = $props();
</script>

<Table.Row>
  <Table.Cell class={compact ? 'px-2 py-1.5 font-mono text-[11px]' : 'font-mono text-xs'}>
    {row.pathLabel}
  </Table.Cell>
  <Table.Cell class="max-w-0 px-2 py-1.5">
    <span class="block truncate" title={row.resolvedLabel}>{row.resolvedLabel}</span>
  </Table.Cell>
  {#if counts_pending}
    <Table.Cell colspan={4} class={compact ? 'px-2 py-1.5' : ''}>
      <Skeleton class="h-4 w-full max-w-xs" />
    </Table.Cell>
  {:else if counts_error}
    <Table.Cell colspan={4} class="text-destructive {compact ? 'px-2 py-1.5 text-xs' : ''}">
      {counts_error}
    </Table.Cell>
  {:else if counts}
    <Table.Cell class="text-right tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {counts.texts}
    </Table.Cell>
    <Table.Cell class="text-right tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {counts.translations}
    </Table.Cell>
    <Table.Cell class="text-right tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {counts.media_attachment}
    </Table.Cell>
    <Table.Cell class="text-right font-medium tabular-nums {compact ? 'px-2 py-1.5' : ''}">
      {counts.total}
    </Table.Cell>
  {/if}
</Table.Row>
