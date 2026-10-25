<script lang="ts">
  import Brain from '@lucide/svelte/icons/brain';
  import AgentMarkdown from '../chat/AgentMarkdown.svelte';
  import StepCollapsible from './StepCollapsible.svelte';
  import StepLine from './StepLine.svelte';

  let { text, running }: { text: string; running: boolean } = $props();

  /** Open while the model thinks, then folds away unless the admin opened it. */
  let user_open = $state<boolean | undefined>(undefined);
</script>

{#if running || text.trim().length > 0}
  <StepCollapsible bind:open={() => user_open ?? running, (value) => (user_open = value)}>
    {#snippet line()}
      <StepLine title={running ? 'Thinking' : 'Thought'} status={running ? 'running' : undefined}>
        {#snippet icon()}<Brain />{/snippet}
      </StepLine>
    {/snippet}
    <AgentMarkdown {text} class="text-xs text-muted-foreground prose-p:my-1.5" />
  </StepCollapsible>
{/if}
