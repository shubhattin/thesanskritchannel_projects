<script lang="ts">
  import type { PageData } from './$types';
  import MetaTags from '$components/tags/MetaTags.svelte';
  import TextsBrowser from '$components/texts/TextsBrowser.svelte';
  import BookOpen from '@lucide/svelte/icons/book-open';

  let { data }: { data: PageData } = $props();
</script>

<MetaTags
  title="Texts — The Sanskrit Channel"
  description="Browse classical Sanskrit texts. Read in a clean interface and switch between multiple Indian scripts."
/>

<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
  <header class="mb-10 border-b border-border/50 pb-8">
    <div
      class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold tracking-wide text-primary"
    >
      <BookOpen class="size-3" />
      Sanskrit Library
    </div>
    <h1 class="font-heading text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
      Texts
    </h1>
    <p class="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
      Read classical Sanskrit texts in a clean, distraction-free interface. Switch between multiple
      Indian scripts effortlessly.
    </p>
  </header>

  <TextsBrowser projects={data.projects} />
</div>
