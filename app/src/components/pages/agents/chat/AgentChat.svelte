<script lang="ts">
  import { onMount } from 'svelte';
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import { useQueryClient } from '@tanstack/svelte-query';
  import type { inferRouterOutputs } from '@trpc/server';
  import AlertCircle from '@lucide/svelte/icons/circle-alert';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import LibraryBig from '@lucide/svelte/icons/library-big';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { Button } from '$lib/components/ui/button';
  import { useTRPC } from '~/api/client';
  import type { Router } from '~/api/trpc_router';
  import type { AgentModelId } from '~/agents/models';
  import type { AgentUIMessage } from '~/agents/ui_message';
  import { AGENT_SUGGESTIONS } from '../agent_meta';
  import { takePendingMessage } from '../pending_message';
  import MobileHistoryButton from '../sidebar/MobileHistoryButton.svelte';
  import AssistantMessage from './AssistantMessage.svelte';
  import ChatComposer from './ChatComposer.svelte';
  import ChatCost from './ChatCost.svelte';
  import ContextDialog from './ContextDialog.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import QueuedMessages from './QueuedMessages.svelte';
  import ThinkingLine from './ThinkingLine.svelte';
  import { MessageQueue, type QueuedMessage } from './message_queue';
  import { messageText } from './message_parts';

  export type AgentChatData = inferRouterOutputs<Router>['agents']['get_chat'];

  /** Mounted once per chat id (keyed by the page), so the initial data seeds the chat. */
  let { data }: { data: AgentChatData } = $props();

  const trpc = useTRPC();
  const query_client = useQueryClient();

  // svelte-ignore state_referenced_locally
  const chat_id = data.chat.id;
  // svelte-ignore state_referenced_locally
  let model = $state<AgentModelId>(data.chat.model);
  let context_open = $state(false);

  const refresh_sidebar = () =>
    void query_client.invalidateQueries({ queryKey: trpc.agents.list_chats.queryKey() });

  const chat = new Chat<AgentUIMessage>({
    id: chat_id,
    // svelte-ignore state_referenced_locally
    messages: data.messages,
    transport: new DefaultChatTransport<AgentUIMessage>({
      api: '/api/agents/chat',
      // Only the new message (plus the per-request model): history is loaded server-side.
      prepareSendMessagesRequest: ({ id, messages, body }) => ({
        body: { ...body, id, message: messages.at(-1) }
      })
    }),
    onFinish: () => {
      refresh_sidebar();
      // Title + streaming flag land with the save; pick up the fresh chat state.
      void query_client.invalidateQueries({
        queryKey: trpc.agents.get_chat.queryKey({ id: chat_id })
      });
      // The title is saved as the stream closes; pick it up a moment later too.
      setTimeout(refresh_sidebar, 1_500);
    }
  });

  const busy = $derived(chat.status === 'submitted' || chat.status === 'streaming');
  const last_message = $derived(chat.messages.at(-1));

  /** Set once this view sends: from then on the local conversation wins over refetches. */
  let sent_locally = false;

  /**
   * Messages typed while a reply streams. Per chat: this view mounts once per chat id
   * (keyed by the page), so switching chats mounts a fresh queue and unmount drops it.
   */
  const queue = $state(new MessageQueue());
  /** The user stopped a run: the queue waits for an explicit send. Cleared on any send. */
  let user_stopped = $state(false);
  let composer = $state<{ setText: (value: string) => void } | null>(null);

  const send = (text: string) => {
    sent_locally = true;
    stick_to_bottom = true;
    user_stopped = false;
    void chat.sendMessage({ text }, { body: { model } });
  };

  const enqueue = (text: string) => {
    queue.enqueue(text);
    stick_to_bottom = true;
  };

  const stop = () => {
    user_stopped = true;
    void chat.stop();
  };

  /** Stop the in-flight reply and send this queued message immediately. */
  const send_now = (item: QueuedMessage) => {
    const pending = queue.items.find((queued) => queued.id === item.id);
    if (!pending) return;
    queue.remove(pending.id);
    // Suppress the auto-send while the abort lands; send() below re-arms it.
    user_stopped = true;
    sent_locally = true;
    stick_to_bottom = true;
    void (async () => {
      await chat.stop();
      send(pending.text);
    })();
  };

  const edit_queued = (item: QueuedMessage) => {
    if (!composer) return;
    queue.remove(item.id);
    composer.setText(item.text);
  };

  // When a run finishes normally, send the next queued message. Not after an error
  // (status is 'error' then, and the queue waits for the user's Retry or send) and not
  // after the user pressed Stop (user_stopped). The transition guard also makes the
  // shift+send atomic: the effect re-runs on the queue change but status is no longer
  // freshly 'ready', so it can't send twice. No client tools exist in this chat, so a
  // 'ready' status means no continuation is pending — multi-step server tool calls keep
  // the status at 'submitted'/'streaming' throughout.
  let prev_status = chat.status;
  $effect(() => {
    const status = chat.status;
    const just_finished = prev_status !== 'ready' && status === 'ready';
    prev_status = status;
    if (!just_finished) return;
    if (queue.size === 0 || user_stopped || chat.error) return;
    const next = queue.shift();
    if (next) send(next.text);
  });

  onMount(() => {
    const pending = takePendingMessage(chat_id);
    if (pending) send(pending);
  });

  // A reply generated elsewhere (background stream, another tab) lands in the DB while this view
  // is idle: adopt it so refresh / back-navigation shows the finished turn.
  $effect(() => {
    if (
      !busy &&
      !sent_locally &&
      !data.chat.streaming &&
      data.messages.length > chat.messages.length
    ) {
      chat.messages = data.messages;
    }
  });

  // Warn before dropping an in-flight reply with a reload or tab close.
  $effect(() => {
    if (!busy) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });

  // Follow the reply while the admin is at the bottom; stop following once they scroll up.
  let viewport = $state<HTMLDivElement | null>(null);
  let content = $state<HTMLDivElement | null>(null);
  let stick_to_bottom = $state(true);

  const scroll_to_bottom = (behavior: ScrollBehavior = 'auto') =>
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior });

  $effect(() => {
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (stick_to_bottom) scroll_to_bottom();
    });
    observer.observe(content);
    return () => observer.disconnect();
  });
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="flex items-center gap-2 border-b border-border/70 px-3 py-2">
    <MobileHistoryButton />
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-sm font-semibold text-foreground">
        {data.chat.title || 'New chat'}
      </h1>
    </div>
    <ChatCost messages={chat.messages} />
    <Button variant="outline" size="sm" onclick={() => (context_open = true)}>
      <LibraryBig />
      Context
    </Button>
  </header>
  {#if !busy && data.chat.streaming}
    <p
      role="status"
      class="flex items-center justify-center gap-2 border-b border-border/70 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <span class="size-1.5 animate-pulse rounded-full bg-primary"></span>
      Replying in the background — it will appear here when it lands.
    </p>
  {/if}

  <div class="relative min-h-0 flex-1">
    {#if chat.messages.length === 0 && !busy}
      <div
        class="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-5 px-4 text-center"
      >
        <div class="flex flex-col gap-1">
          <p class="text-lg font-semibold">Admin agent</p>
          <p class="text-sm text-muted-foreground">
            Searches the texts and queries the database to answer your questions.
          </p>
        </div>
        <div class="flex flex-wrap justify-center gap-2">
          {#each AGENT_SUGGESTIONS as suggestion (suggestion)}
            <Button
              variant="outline"
              size="sm"
              class="h-auto rounded-full py-1.5 whitespace-normal"
              onclick={() => send(suggestion)}
            >
              {suggestion}
            </Button>
          {/each}
        </div>
      </div>
    {:else}
      <div
        bind:this={viewport}
        class="h-full overflow-y-auto"
        onscroll={() => {
          if (!viewport) return;
          const gap = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
          stick_to_bottom = gap < 80;
        }}
      >
        <div
          bind:this={content}
          aria-busy={busy}
          class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6"
        >
          {#each chat.messages as message (message.id)}
            {#if message.role === 'user'}
              <div class="flex justify-end">
                <div
                  class="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2 text-sm whitespace-pre-wrap text-foreground"
                >
                  {messageText(message)}
                </div>
              </div>
            {:else}
              <AssistantMessage {message} streaming={busy && message === last_message} />
            {/if}
          {/each}
          {#if chat.status === 'submitted' && last_message?.role === 'user'}
            <ThinkingLine />
          {/if}
          {#if chat.error && !busy}
            <div
              class="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle class="mt-0.5 size-4 shrink-0" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <p class="break-words">{chat.error.message || 'The agent failed to reply.'}</p>
                <Button
                  size="xs"
                  variant="outline"
                  class="self-start"
                  onclick={() => void chat.regenerate({ body: { model } })}
                >
                  <RotateCcw />
                  Retry
                </Button>
              </div>
            </div>
          {/if}
        </div>
      </div>
      {#if !stick_to_bottom}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Scroll to bottom"
          class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-sm"
          onclick={() => {
            stick_to_bottom = true;
            scroll_to_bottom('smooth');
          }}
        >
          <ArrowDown />
        </Button>
      {/if}
    {/if}
  </div>

  <div class="mx-auto w-full max-w-3xl px-4 pb-4">
    <QueuedMessages
      items={queue.items}
      {busy}
      onedit={edit_queued}
      onsendnow={send_now}
      onremove={(item) => queue.remove(item.id)}
    />
    <ChatComposer
      bind:this={composer}
      {busy}
      onstop={stop}
      onsend={send}
      onqueue={enqueue}
      placeholder="Ask about texts, translations, lekhas…"
      autofocus
    >
      {#snippet toolbar()}
        <ModelPicker bind:value={model} disabled={busy} />
      {/snippet}
    </ChatComposer>
  </div>
</div>

<ContextDialog bind:open={context_open} />
