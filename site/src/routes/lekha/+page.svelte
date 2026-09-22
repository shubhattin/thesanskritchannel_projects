<script lang="ts">
  import MetaTags from '$components/tags/MetaTags.svelte';
  import LekhaListBrowser from '$components/lekha/LekhaListBrowser.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const title = 'Lekha — The Sanskrit Channel';
  const description = 'Notes and articles from The Sanskrit Channel.';
</script>

<MetaTags
  {title}
  {description}
  keywords={['Lekha', 'Sanskrit articles', 'Sanskrit notes', 'The Sanskrit Channel']}
/>

<div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <header class="mb-10 border-b border-border pb-8">
    <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Lekha</h1>
    <p class="mt-3 text-muted-foreground">{description}</p>
  </header>

  <LekhaListBrowser posts={data.posts} />
</div>
