<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import Info from '@lucide/svelte/icons/info';
  import type { AgentMessageMetadata } from '~/agents/ui_message';
  import { formatCost, modelLabel, usageLine } from './cost';

  let { metadata }: { metadata: AgentMessageMetadata | undefined } = $props();

  const tokens = $derived(metadata ? usageLine(metadata.usage) : null);
  const label = $derived(modelLabel(metadata?.model));
</script>

{#if metadata?.cost !== undefined}
  <Popover.Root>
    <Popover.Trigger
      aria-label={`Reply cost ${formatCost(metadata.cost)}`}
      class="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
    >
      <Info class="size-3.5" />
    </Popover.Trigger>
    <Popover.Content align="start" class="flex w-60 flex-col gap-1 text-xs">
      <span>
        Cost {formatCost(metadata.cost)}
        {#if label}· {label}{/if}
      </span>
      {#if tokens}<span class="text-muted-foreground tabular-nums">{tokens}</span>{/if}
      <span class="text-muted-foreground/70"
        >As charged by OpenRouter, cache discounts included.</span
      >
    </Popover.Content>
  </Popover.Root>
{/if}
