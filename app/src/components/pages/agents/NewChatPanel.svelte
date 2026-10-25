<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { nanoid } from 'nanoid';
  import { toast } from 'svelte-sonner';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import Bot from '@lucide/svelte/icons/bot';
  import { Button } from '$lib/components/ui/button';
  import { useTRPC } from '~/api/client';
  import { AGENT_DEFAULT_MODEL, type AgentModelId } from '~/agents/models';
  import { AGENT_SUGGESTIONS } from './agent_meta';
  import ChatComposer from './chat/ChatComposer.svelte';
  import ModelPicker from './chat/ModelPicker.svelte';
  import { setPendingMessage } from './pending_message';
  import MobileHistoryButton from './sidebar/MobileHistoryButton.svelte';

  /** Pick a model and send the first message; the reply streams on the chat's own URL. */
  const trpc = useTRPC();
  const query_client = useQueryClient();
  let model = $state<AgentModelId>(AGENT_DEFAULT_MODEL);

  const create_mut = createMutation(() =>
    trpc.agents.create_chat.mutationOptions({
      onSuccess: (chat) => {
        void query_client.invalidateQueries({ queryKey: trpc.agents.list_chats.queryKey() });
        void goto(resolve(`/agents/${chat.id}`));
      },
      onError: (error) => toast.error(error.message)
    })
  );

  const start = (text: string) => {
    const id = nanoid(16);
    setPendingMessage(id, text);
    create_mut.mutate({ id, model });
  };
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="flex items-center gap-2 px-3 py-2 md:hidden">
    <MobileHistoryButton />
    <span class="text-sm font-semibold">New chat</span>
  </header>
  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:py-14">
      <div class="flex flex-col items-center gap-2 text-center">
        <span
          class="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          <Bot class="size-6" />
        </span>
        <h1 class="text-2xl font-black tracking-tight">Admin agent</h1>
        <p class="text-sm text-muted-foreground">
          Ask about the texts, translations and lekhas. It searches the texts (like
          <a href={resolve('/search')} class="text-primary underline-offset-2 hover:underline"
            >/search</a
          >), reads the database and searches the web — it never changes anything.
        </p>
      </div>

      <ChatComposer
        busy={create_mut.isPending}
        onsend={start}
        placeholder="Ask about texts, translations, lekhas…"
        autofocus
      >
        {#snippet toolbar()}
          <ModelPicker bind:value={model} />
        {/snippet}
      </ChatComposer>

      <div class="flex flex-wrap justify-center gap-2">
        {#each AGENT_SUGGESTIONS as suggestion (suggestion)}
          <Button
            variant="outline"
            size="sm"
            disabled={create_mut.isPending}
            class="h-auto rounded-full py-1.5 whitespace-normal"
            onclick={() => start(suggestion)}
          >
            {suggestion}
          </Button>
        {/each}
      </div>
    </div>
  </div>
</div>
