<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { useTRPC } from '~/api/client';
  import AgentChat from '~/components/pages/agents/chat/AgentChat.svelte';

  const trpc = useTRPC();
  const chat_id = $derived(page.params.chat_id ?? '');

  const chat_q = createQuery(() =>
    trpc.agents.get_chat.queryOptions(
      { id: chat_id },
      {
        // The chat owns its messages once mounted; refetches only refresh chat metadata.
        // While a reply streams in the background, poll so it appears when it lands.
        refetchOnWindowFocus: false,
        retry: false,
        refetchInterval: (query) => (query.state.data?.chat.streaming ? 2500 : false)
      }
    )
  );
</script>

{#if chat_q.isPending}
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
    <Skeleton class="h-6 w-56" />
    <Skeleton class="ml-auto h-10 w-2/3 rounded-2xl" />
    <Skeleton class="h-24 w-full" />
  </div>
{:else if chat_q.isError}
  <div class="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
    <p class="text-sm text-muted-foreground">{chat_q.error.message}</p>
    <Button href="/agents" variant="outline" size="sm">Start a new chat</Button>
  </div>
{:else}
  {#key chat_q.data.chat.id}
    <AgentChat data={chat_q.data} />
  {/key}
{/if}
