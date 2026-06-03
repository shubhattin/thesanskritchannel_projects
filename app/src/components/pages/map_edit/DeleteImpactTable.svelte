<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import type { DeleteReviewRow } from './map_edit_lib';
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
  <div class="rounded-md border border-border/60">
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
          <DeleteImpactRow {project_id} {row} {compact} />
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
