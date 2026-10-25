<script lang="ts">
  import TextSearch from '@lucide/svelte/icons/text-search';
  import type { AgentToolPart } from '../chat/message_parts';
  import StepCollapsible from './StepCollapsible.svelte';
  import StepLine from './StepLine.svelte';

  let { part, streaming }: { part: AgentToolPart<'search_texts'>; streaming: boolean } = $props();

  const mode_label = $derived(part.input?.mode === 'name' ? 'names' : 'texts');
  const query = $derived(part.input?.query);
</script>

{#snippet icon()}<TextSearch />{/snippet}

{#if part.state === 'output-available' || part.state === 'output-error'}
  {@const failed = part.state === 'output-error'}
  <StepCollapsible>
    {#snippet line()}
      <StepLine
        {icon}
        title={failed ? 'Search failed' : `Searched ${mode_label}`}
        description={[
          query ? `“${query}”` : null,
          part.state === 'output-available'
            ? `${part.output.total_count} match${part.output.total_count === 1 ? '' : 'es'}`
            : null
        ]
          .filter(Boolean)
          .join(' · ')}
        status={failed ? 'error' : undefined}
      />
    {/snippet}
    {#if part.input?.project_keys?.length || part.input?.path_prefix}
      <p class="text-xs text-muted-foreground">
        {#if part.input.project_keys?.length}In {part.input.project_keys.join(', ')}{/if}
        {#if part.input.path_prefix}under path {part.input.path_prefix}{/if}
      </p>
    {/if}
    {#if part.state === 'output-error'}
      <p class="text-xs break-words text-destructive">{part.errorText}</p>
    {:else if part.output.results.length === 0}
      <p class="text-xs text-muted-foreground">No matches.</p>
    {:else}
      <ul class="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {#each part.output.results as hit (hit.href)}
          <li>
            <a
              href={hit.href}
              target="_blank"
              rel="noopener"
              class="block rounded-lg border border-border/70 px-3 py-2 text-xs no-underline transition-colors hover:bg-muted/50"
            >
              <span class="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
                <span class="font-semibold text-foreground">{hit.project_name}</span>
                <span>›</span>
                <span>{hit.location}</span>
                {#if hit.shloka_num}<span>· {hit.shloka_num}</span>{/if}
              </span>
              <span class="mt-1 line-clamp-3 block whitespace-pre-line text-foreground">
                {hit.text}
              </span>
            </a>
          </li>
        {/each}
      </ul>
      {#if part.output.has_more}
        <p class="text-[11px] text-muted-foreground">
          Showing {part.output.results.length} of {part.output.total_count}
        </p>
      {/if}
    {/if}
  </StepCollapsible>
{:else}
  <StepLine
    {icon}
    title={streaming ? `Searching ${mode_label}` : 'Search interrupted'}
    description={query ? `“${query}”` : undefined}
    status={streaming ? 'running' : 'error'}
  />
{/if}
