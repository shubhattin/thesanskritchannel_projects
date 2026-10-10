<script lang="ts">
  import MetaTags from '$components/tags/MetaTags.svelte';
  import LekhaListBrowser from '$components/lekha/LekhaListBrowser.svelte';
  import MainTextScriptSelector from '$components/main_text/MainTextScriptSelector.svelte';
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

<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
  <header class="mb-10 border-b border-border pb-8">
    <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Lekha</h1>
        <p class="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <MainTextScriptSelector />
    </div>
  </header>

  <LekhaListBrowser posts={data.posts} ssr_script_id={data.ssr_script_id} />
</div>
