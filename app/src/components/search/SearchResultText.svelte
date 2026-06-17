<script lang="ts">
  import { split_text_by_search_query } from '~/utils/search/search_highlight';

  let {
    text,
    query
  }: {
    text: string;
    query: string;
  } = $props();

  const segments = $derived(split_text_by_search_query(text, query));
</script>

{#each segments as segment, i (i)}
  {#if segment.highlight}
    <mark
      class="rounded-sm bg-primary/35 px-0.5 text-inherit ring-1 ring-primary/50 dark:bg-primary/25"
      >{segment.text}</mark
    >
  {:else}
    {segment.text}
  {/if}
{/each}
