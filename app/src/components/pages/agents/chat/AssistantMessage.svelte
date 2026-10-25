<script lang="ts">
  import type { AgentUIMessage } from '~/agents/ui_message';
  import ReasoningStep from '../tools/ReasoningStep.svelte';
  import SearchTextsStep from '../tools/SearchTextsStep.svelte';
  import SqlQueryStep from '../tools/SqlQueryStep.svelte';
  import WebSearchStep from '../tools/WebSearchStep.svelte';
  import AgentMarkdown from './AgentMarkdown.svelte';
  import ThinkingLine from './ThinkingLine.svelte';
  import { groupParts, isWaitingForNextStep } from './message_parts';

  /** One agent turn: step traces and replies, in the order they happened. */
  let { message, streaming }: { message: AgentUIMessage; streaming: boolean } = $props();

  const groups = $derived(groupParts(message.parts));
  const waiting = $derived(streaming && isWaitingForNextStep(message));
</script>

<div class="flex w-full min-w-0 flex-col gap-3">
  {#each groups as group (group.key)}
    {#if group.kind === 'steps'}
      <div class="flex flex-col gap-0.5 border-l-2 border-border/70 pl-3">
        {#each group.parts as part, index (index)}
          {#if part.type === 'reasoning'}
            <ReasoningStep text={part.text} running={streaming && part.state === 'streaming'} />
          {:else if part.type === 'tool-sql_query'}
            <SqlQueryStep {part} {streaming} />
          {:else if part.type === 'tool-search_texts'}
            <SearchTextsStep {part} {streaming} />
          {:else if part.type === 'tool-web_search'}
            <WebSearchStep {part} {streaming} />
          {/if}
        {/each}
      </div>
    {:else}
      <AgentMarkdown text={group.text} />
    {/if}
  {/each}
  {#if waiting}
    <ThinkingLine />
  {/if}
</div>
