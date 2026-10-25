<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import MessageSquareText from '@lucide/svelte/icons/message-square-text';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as InputGroup from '$lib/components/ui/input-group';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { cn } from '$lib/utils';
  import { useTRPC } from '~/api/client';
  import { groupChatsByDate } from './chat_groups';
  import DeleteChatDialog from './DeleteChatDialog.svelte';
  import RenameChatDialog from './RenameChatDialog.svelte';

  type ChatRef = { id: string; title: string };

  let { onnavigate }: { onnavigate?: () => void } = $props();

  const trpc = useTRPC();
  const chats_q = createQuery(() =>
    trpc.agents.list_chats.queryOptions(undefined, {
      // While any chat streams in the background, keep the list fresh.
      refetchInterval: (query) => (query.state.data?.some((chat) => chat.streaming) ? 3000 : false)
    })
  );

  let search = $state('');
  let renaming = $state<ChatRef | null>(null);
  let deleting = $state<ChatRef | null>(null);

  const active_id = $derived(page.params.chat_id);
  const chats = $derived.by(() => {
    const needle = search.trim().toLowerCase();
    return (chats_q.data ?? []).filter(
      (chat) => !needle || (chat.title || 'new chat').toLowerCase().includes(needle)
    );
  });
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex flex-col gap-2 px-3 pb-2">
    <Button href="/" variant="ghost" size="sm" class="-ml-1 justify-start text-muted-foreground">
      <ArrowLeft />
      Back to home
    </Button>
    <Button href="/agents" variant="outline" class="justify-start" onclick={onnavigate}>
      <Plus />
      New chat
    </Button>
    <InputGroup.Root class="h-8">
      <InputGroup.Addon>
        <Search />
      </InputGroup.Addon>
      <InputGroup.Input bind:value={search} placeholder="Search chats" aria-label="Search chats" />
    </InputGroup.Root>
  </div>

  <nav aria-label="Chat history" class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
    {#if chats_q.isPending}
      <div class="flex flex-col gap-1.5 px-1">
        {#each Array.from({ length: 6 }, (_, index) => index) as index (index)}
          <Skeleton class="h-8 w-full" />
        {/each}
      </div>
    {:else if chats.length === 0}
      <p class="px-2 py-6 text-center text-xs text-muted-foreground">
        {chats_q.data?.length ? 'No chats match.' : 'No chats yet.'}
      </p>
    {:else}
      {#each groupChatsByDate(chats) as group (group.label)}
        <section class="mb-3">
          <h2 class="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</h2>
          <ul class="flex flex-col gap-0.5">
            {#each group.chats as chat (chat.id)}
              <li class="group/chat relative">
                <a
                  href={resolve(`/agents/${chat.id}`)}
                  onclick={onnavigate}
                  class={cn(
                    'flex items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm no-underline transition-colors',
                    active_id === chat.id
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <MessageSquareText class="size-4 shrink-0 text-muted-foreground" />
                  <span class="min-w-0 flex-1 truncate">{chat.title || 'New chat'}</span>
                  {#if chat.streaming}
                    <span
                      title="Replying in the background"
                      class="size-1.5 shrink-0 animate-pulse rounded-full bg-primary"
                    ></span>
                  {/if}
                </a>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Actions for ${chat.title || 'chat'}`}
                        class="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
                      >
                        <Ellipsis />
                      </Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" class="w-36">
                    <DropdownMenu.Item onclick={() => (renaming = chat)}>
                      <Pencil />
                      Rename
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item variant="destructive" onclick={() => (deleting = chat)}>
                      <Trash2 />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    {/if}
  </nav>

  {#if renaming}
    {#key renaming.id}
      <RenameChatDialog chat={renaming} onclose={() => (renaming = null)} />
    {/key}
  {/if}
  <DeleteChatDialog chat={deleting} onclose={() => (deleting = null)} />
</div>
