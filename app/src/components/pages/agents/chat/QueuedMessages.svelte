<script lang="ts">
  import Pencil from '@lucide/svelte/icons/pencil';
  import X from '@lucide/svelte/icons/x';
  import Zap from '@lucide/svelte/icons/zap';
  import { Button } from '$lib/components/ui/button';
  import type { QueuedMessage } from './message_queue';

  /** Compact list of messages queued while the reply streams, shown just above the composer. */
  let {
    items,
    busy,
    onedit,
    onsendnow,
    onremove
  }: {
    items: QueuedMessage[];
    busy: boolean;
    onedit: (item: QueuedMessage) => void;
    onsendnow: (item: QueuedMessage) => void;
    onremove: (item: QueuedMessage) => void;
  } = $props();
</script>

{#if items.length > 0}
  <div
    role="list"
    aria-label="Queued messages"
    class="mb-2 flex flex-col gap-1 rounded-2xl border border-border/70 bg-muted/40 px-2 py-1.5"
  >
    <p class="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {busy ? 'Queued · sends when the reply finishes' : 'Queued'}
    </p>
    {#each items as item (item.id)}
      <div role="listitem" class="flex min-w-0 items-center gap-0.5">
        <span class="min-w-0 flex-1 truncate px-1 text-xs text-foreground">
          {item.text}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Edit queued message"
          title="Edit queued message"
          onclick={() => onedit(item)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Send now"
          title="Stop the current reply and send this now"
          onclick={() => onsendnow(item)}
        >
          <Zap />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Remove queued message"
          title="Remove queued message"
          onclick={() => onremove(item)}
        >
          <X />
        </Button>
      </div>
    {/each}
  </div>
{/if}
