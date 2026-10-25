<script lang="ts">
  import Globe from '@lucide/svelte/icons/globe';
  import AgentMarkdown from '../chat/AgentMarkdown.svelte';
  import type { AgentToolPart } from '../chat/message_parts';
  import StepCollapsible from './StepCollapsible.svelte';
  import StepLine from './StepLine.svelte';

  /** Collapsed: that a search ran. Expanded: the query, what was found, and the sources. */
  let { part, streaming }: { part: AgentToolPart<'web_search'>; streaming: boolean } = $props();

  const host_of = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
</script>

{#snippet icon()}<Globe />{/snippet}

{#if part.state === 'output-available' || part.state === 'output-error'}
  {@const failed = part.state === 'output-error'}
  {@const sources = part.state === 'output-available' ? part.output.sources : []}
  <StepCollapsible>
    {#snippet line()}
      <StepLine
        {icon}
        title={failed ? 'Web search failed' : 'Searched the web'}
        description={failed
          ? undefined
          : `${sources.length} source${sources.length === 1 ? '' : 's'}`}
        status={failed ? 'error' : undefined}
      />
    {/snippet}
    {#if part.input?.query}
      <p class="text-xs">
        <span class="text-muted-foreground">Query: </span>
        <span class="font-medium text-foreground">{part.input.query}</span>
      </p>
    {/if}
    {#if part.state === 'output-error'}
      <p class="text-xs break-words text-destructive">{part.errorText}</p>
    {:else}
      <div class="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
        <AgentMarkdown text={part.output.summary} class="text-xs prose-p:my-1.5" />
      </div>
      {#if sources.length > 0}
        <ul class="flex flex-col gap-1">
          {#each sources as source (source.url)}
            <li class="min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                class="group flex min-w-0 items-center gap-2 text-xs no-underline"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${host_of(source.url)}&sz=32`}
                  alt=""
                  class="size-3.5 shrink-0 rounded-sm"
                  loading="lazy"
                />
                <span class="truncate text-foreground group-hover:underline">
                  {source.title || host_of(source.url)}
                </span>
                <span class="shrink-0 text-muted-foreground/70">{host_of(source.url)}</span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </StepCollapsible>
{:else}
  <StepLine
    {icon}
    title={streaming ? 'Searching the web' : 'Search interrupted'}
    status={streaming ? 'running' : 'error'}
  />
{/if}
