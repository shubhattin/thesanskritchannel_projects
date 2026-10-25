<script lang="ts">
  import Database from '@lucide/svelte/icons/database';
  import type { AgentToolPart } from '../chat/message_parts';
  import StepCollapsible from './StepCollapsible.svelte';
  import StepLine from './StepLine.svelte';

  let { part, streaming }: { part: AgentToolPart<'sql_query'>; streaming: boolean } = $props();

  const purpose = $derived(part.input?.purpose);
</script>

{#snippet icon()}<Database />{/snippet}

{#if part.state === 'output-available' || part.state === 'output-error'}
  {@const failed = part.state === 'output-error'}
  <StepCollapsible>
    {#snippet line()}
      <StepLine
        {icon}
        title={failed ? 'Query failed' : 'Queried the database'}
        description={[
          purpose,
          part.state === 'output-available' ? `${part.output.row_count} rows` : null
        ]
          .filter(Boolean)
          .join(' · ')}
        status={failed ? 'error' : undefined}
      />
    {/snippet}
    {#if part.input?.query}
      <pre
        class="max-h-64 overflow-auto rounded-lg border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">{part.input.query.trim()}</pre>
    {/if}
    {#if part.state === 'output-error'}
      <p class="text-xs break-words text-destructive">{part.errorText}</p>
    {:else if part.output.columns.length === 0}
      <p class="text-xs text-muted-foreground">No rows.</p>
    {:else}
      <div class="max-h-80 overflow-auto rounded-lg border border-border/70">
        <table class="w-full border-collapse text-xs">
          <thead class="sticky top-0 bg-muted/90 backdrop-blur">
            <tr>
              {#each part.output.columns as column (column)}
                <th
                  class="border-b border-border/70 px-2.5 py-1.5 text-left font-semibold whitespace-nowrap text-foreground"
                >
                  {column}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each part.output.rows as row, row_index (row_index)}
              <tr class="odd:bg-background even:bg-muted/30">
                {#each row as cell, cell_index (cell_index)}
                  <td
                    class="max-w-80 truncate border-b border-border/40 px-2.5 py-1 align-top text-foreground"
                    title={cell === null ? undefined : String(cell)}
                  >
                    {#if cell === null}
                      <span class="text-muted-foreground/60">null</span>
                    {:else if typeof cell === 'boolean'}
                      <span class="font-mono">{String(cell)}</span>
                    {:else}
                      {String(cell)}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="text-[11px] text-muted-foreground tabular-nums">
        {part.output.row_count} row{part.output.row_count === 1 ? '' : 's'}
        {part.output.truncated ? ' (truncated)' : ''} · {part.output.duration_ms} ms
      </p>
    {/if}
  </StepCollapsible>
{:else}
  <StepLine
    {icon}
    title={streaming ? 'Querying the database' : 'Query interrupted'}
    description={purpose}
    status={streaming ? 'running' : 'error'}
  />
{/if}
