<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { useTRPC } from '~/api/client';

  /** Everything the agent reads before the conversation. */
  let { open = $bindable(false) }: { open?: boolean } = $props();

  const trpc = useTRPC();
  const context_q = createQuery(() => ({
    ...trpc.agents.get_context.queryOptions(),
    enabled: open
  }));
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[85dvh] flex-col sm:max-w-3xl">
    <Dialog.Header>
      <Dialog.Title>Agent context</Dialog.Title>
      <Dialog.Description>
        What the agent reads before every conversation: its instructions, the database schema and
        the project catalog.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {#if context_q.isPending}
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
      {:else if context_q.isError}
        <p class="text-sm text-destructive">{context_q.error.message}</p>
      {:else}
        {#each context_q.data as section, index (section.id)}
          <Collapsible.Root open={index === 0} class="rounded-lg border border-border/70">
            <Collapsible.Trigger
              class="group/section flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
            >
              <ChevronRight
                class="size-4 text-muted-foreground transition-transform group-data-[state=open]/section:rotate-90"
              />
              {section.title}
              <span class="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                {section.content.length.toLocaleString()} chars
              </span>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <pre
                class="max-h-96 overflow-auto border-t border-border/70 bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{section.content}</pre>
            </Collapsible.Content>
          </Collapsible.Root>
        {/each}
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
