<script lang="ts">
  import '@fontsource/roboto/latin.css';
  import '../app.css';
  import '../app.scss';
  import { type Snippet } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from '~/state/queryClient';
  import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
  import TopAppBar from '~/components/TopAppBar.svelte';
  import PostHogInit from '~/components/tags/PostHogInit.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <ModeWatcher />
  <div class="contaiiner mx-auto mb-12 max-w-screen-lg">
    <TopAppBar />
    <div class="mx-2">
      {@render children()}
    </div>
  </div>
  <SvelteQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
<PostHogInit />
