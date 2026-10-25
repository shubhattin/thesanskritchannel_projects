<script lang="ts">
  import type { Snippet } from 'svelte';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Square from '@lucide/svelte/icons/square';
  import * as InputGroup from '$lib/components/ui/input-group';

  /** Message field: Enter sends, Shift+Enter adds a line, Stop while the agent replies. */
  let {
    onsend,
    onstop,
    busy,
    placeholder = 'Message the agent…',
    toolbar,
    autofocus = false
  }: {
    onsend: (text: string) => void;
    onstop?: () => void;
    busy: boolean;
    placeholder?: string;
    /** Left side of the bottom bar (e.g. the model picker). */
    toolbar?: Snippet;
    autofocus?: boolean;
  } = $props();

  let text = $state('');
  let textarea = $state<HTMLTextAreaElement | null>(null);
  const can_send = $derived(text.trim().length > 0 && !busy);

  const submit = () => {
    if (!can_send) return;
    onsend(text.trim());
    text = '';
  };

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
          class="ml-auto rounded-full"
          aria-label="Stop"
          onclick={onstop}
        >
          <Square class="size-3 fill-current" />
        </InputGroup.Button>
      {:else}
        <InputGroup.Button
          type="submit"
          variant="default"
          size="icon-sm"
          class="ml-auto rounded-full transition-opacity duration-300 disabled:opacity-70"
          disabled={!can_send}
          aria-label="Send"
        >
          <ArrowUp />
        </InputGroup.Button>
      {/if}
    </InputGroup.Addon>
  </InputGroup.Root>
</form>
