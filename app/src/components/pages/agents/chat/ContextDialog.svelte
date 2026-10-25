<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Tabs from '$lib/components/ui/tabs';
  import { useTRPC } from '~/api/client';

  /** Everything the agent reads before the conversation, one tab per section. */
  let { open = $bindable(false) }: { open?: boolean } = $props();

  const trpc = useTRPC();
  const context_q = createQuery(() => ({
    ...trpc.agents.get_context.queryOptions(),
    enabled: open
  }));

  let tab = $state<string | null>(null);
  const active_tab = $derived(tab ?? context_q.data?.[0]?.id ?? 'system_prompt');

  const approx_tokens = (text: string) => Math.round(text.length / 3.5);

  let copied_id = $state<string | null>(null);
  const copy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    copied_id = id;
    setTimeout(() => {
      if (copied_id === id) copied_id = null;
    }, 1_500);
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex h-[min(88dvh,56rem)] flex-col gap-0 p-0 sm:max-w-4xl">
    <Dialog.Header class="gap-1 border-b border-border/70 p-4 pr-12">
      <Dialog.Title>Agent context</Dialog.Title>
      <Dialog.Description>
        What the agent reads before your messages, in this order.
      </Dialog.Description>
    </Dialog.Header>

    {#if context_q.isPending}
      <div class="flex flex-col gap-2 p-4">
        <Skeleton class="h-8 w-80" />
        <Skeleton class="h-96 w-full" />
      </div>
    {:else if context_q.isError}
      <p class="p-4 text-sm text-destructive">{context_q.error.message}</p>
    {:else}
      <Tabs.Root
        value={active_tab}
        onValueChange={(value) => (tab = value)}
        class="flex min-h-0 flex-1 flex-col gap-3 p-4"
      >
        <Tabs.List class="max-w-full justify-start overflow-x-auto">
          {#each context_q.data as section, index (section.id)}
            <Tabs.Trigger value={section.id} class="flex-none">
              {index + 1}. {section.title}
            </Tabs.Trigger>
          {/each}
        </Tabs.List>
        {#each context_q.data as section (section.id)}
          <Tabs.Content
            value={section.id}
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70"
          >
            <div
              class="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
            >
              <span class="min-w-0 flex-1 truncate">
                {section.title} · ~{approx_tokens(section.content).toLocaleString()} tokens
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy section"
                onclick={() => void copy(section.id, section.content)}
              >
                {#if copied_id === section.id}
                  <Check />
                {:else}
                  <Copy />
                {/if}
              </Button>
            </div>
            <pre
              class="min-h-0 flex-1 overflow-auto bg-muted/20 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{section.content}</pre>
          </Tabs.Content>
        {/each}
      </Tabs.Root>
    {/if}
  </Dialog.Content>
</Dialog.Root>
