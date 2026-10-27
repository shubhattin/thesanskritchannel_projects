<script lang="ts">
  import type { Snippet } from 'svelte';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Square from '@lucide/svelte/icons/square';
  import * as InputGroup from '$lib/components/ui/input-group';

  /** Message field: Enter sends, Shift+Enter adds a line, Stop while the agent replies. */
  let {
    onsend,
    onqueue,
    onstop,
    busy,
    placeholder = 'Message the agent…',
    toolbar,
    autofocus = false
  }: {
    onsend: (text: string) => void;
    /**
     * Called instead of `onsend` while busy, so the message waits for the in-flight reply.
     * Absent: the composer locks while busy (e.g. the new-chat screen).
     */
    onqueue?: (text: string) => void;
    onstop?: () => void;
    busy: boolean;
    placeholder?: string;
    /** Left side of the bottom bar (e.g. the model picker). */
    toolbar?: Snippet;
    autofocus?: boolean;
  } = $props();

  let text = $state('');
  let textarea = $state<HTMLTextAreaElement | null>(null);
  const can_queue = $derived(busy && onqueue !== undefined);
  const can_send = $derived(text.trim().length > 0 && (!busy || can_queue));

  const submit = () => {
    const value = text.trim();
    if (value.length === 0) return;
    if (can_queue) onqueue?.(value);
    else {
      if (busy) return;
      onsend(value);
    }
    text = '';
  };

  /** Put a queued message back into the composer for editing. */
  export function setText(value: string) {
    text = value;
    textarea?.focus();
  }

  $effect(() => {
    if (autofocus) textarea?.focus();
  });
</script>

<form
  class="w-full"
  onsubmit={(event) => {
    event.preventDefault();
    submit();
  }}
>
  <!-- Focus ring on focus-within, not the group's default focus-visible: after the autofocus,
       Chrome only flips :focus-visible on at the first keypress, so the ring popped in mid-typing. -->
  <InputGroup.Root
    class="rounded-2xl bg-card shadow-sm transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-card"
  >
    <InputGroup.Textarea
      bind:ref={textarea}
      bind:value={text}
      {placeholder}
      aria-label="Message"
      rows={3}
      class="max-h-60 min-h-14 resize-none overflow-y-auto px-3.5 pt-3 text-base md:text-[15px]"
      onkeydown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          submit();
        }
      }}
    />
    <InputGroup.Addon align="block-end" class="gap-1 px-2 pb-2">
      {@render toolbar?.()}
      {#if busy && onstop}
        <InputGroup.Button
          variant="outline"
          size="icon-sm"
          class="rounded-full"
          aria-label="Stop"
          title="Stop the reply"
          onclick={onstop}
        >
          <Square class="size-3 fill-current" />
        </InputGroup.Button>
      {/if}
      {#if !busy || can_queue}
        <InputGroup.Button
          type="submit"
          variant="default"
          size="icon-sm"
          class="ml-auto rounded-full transition-opacity duration-300 disabled:opacity-70"
          disabled={!can_send}
          aria-label={busy ? 'Queue message' : 'Send'}
          title={busy ? 'Queue — sends when the reply finishes' : 'Send'}
        >
          <ArrowUp />
        </InputGroup.Button>
      {/if}
    </InputGroup.Addon>
  </InputGroup.Root>
</form>
