<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import Info from '@lucide/svelte/icons/info';
  import type { AgentUIMessage } from '~/agents/ui_message';
  import { formatCost, usageLine } from './cost';

  let { messages }: { messages: AgentUIMessage[] } = $props();

  const replies = $derived(messages.filter((m) => m.role === 'assistant'));
  const tracked = $derived(replies.filter((m) => m.metadata?.cost !== undefined));
  const untracked = $derived(replies.length - tracked.length);
  const total = $derived(tracked.reduce((sum, m) => sum + (m.metadata?.cost ?? 0), 0));
  const usage = $derived({
    inputTokens: tracked.reduce((s, m) => s + (m.metadata?.usage?.inputTokens ?? 0), 0),
    outputTokens: tracked.reduce((s, m) => s + (m.metadata?.usage?.outputTokens ?? 0), 0),
    cachedInputTokens: tracked.reduce((s, m) => s + (m.metadata?.usage?.cachedInputTokens ?? 0), 0),
    reasoningTokens: tracked.reduce((s, m) => s + (m.metadata?.usage?.reasoningTokens ?? 0), 0)
  });
</script>

{#if replies.length > 0}
  <Popover.Root>
    <Popover.Trigger
      aria-label="Chat cost details"
      class="inline-flex items-center justify-center rounded-md border border-border/70 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Info class="size-3.5" />
    </Popover.Trigger>
    <Popover.Content align="end" class="flex w-64 flex-col gap-1 text-xs">
      <span>
        Actual cost of this chat: {formatCost(total)} over {tracked.length} replies
      </span>
      <span class="text-muted-foreground tabular-nums">{usageLine(usage)}</span>
      {#if untracked > 0}
        <span class="text-muted-foreground">
          {untracked} older {untracked === 1 ? 'reply has' : 'replies have'} no cost recorded.
        </span>
      {/if}
      <span class="text-muted-foreground/70"
        >As charged by OpenRouter, cache discounts included; chat titles not counted.</span
      >
    </Popover.Content>
  </Popover.Root>
{/if}
