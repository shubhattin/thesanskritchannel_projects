<script lang="ts">
  import { onDestroy } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';

  let { text }: { text: string } = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;

  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });

  const trimmed = $derived(text.trim());

  function copy() {
    if (!trimmed) return;
    try {
      const clip = navigator.clipboard;
      if (!clip?.writeText) return;
      void clip
        .writeText(text)
        .then(() => {
          copied = true;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => (copied = false), 1500);
        })
        .catch(() => undefined);
    } catch {
      return;
    }
  }
</script>

{#if trimmed}
  <button
    type="button"
    aria-label={copied ? 'Copied' : 'Copy reply as markdown'}
    title={copied ? 'Copied' : 'Copy reply as markdown'}
    onclick={copy}
    class="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
  >
    {#if copied}
      <Check class="size-3.5" />
    {:else}
      <Copy class="size-3.5" />
    {/if}
  </button>
{/if}
