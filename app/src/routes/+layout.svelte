<script lang="ts">
  import '@fontsource/roboto/latin.css';
  import '../app.css';
  import '../app.scss';
  import { onMount, type Snippet } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { ModeWatcher } from 'mode-watcher';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from '~/state/queryClient';
  import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
  import TopAppBar from '~/components/TopAppBar.svelte';
  import PostHogInit from '~/components/tags/PostHogInit.svelte';
  import { Toaster } from '$lib/components/ui/sonner/index.js';
  import CookieCacheRefresh from '$lib/CookieCacheRefresh.svelte';
  import TRPCProvider from 'trpc-tanstack-svelte-query/TRPCContext.svelte';
  import { client } from '~/api/client';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      toast.warning(
        'Firefox browser detected. Some network requests might be blocked by Firefox Enhanced Tracking Protection or extensions. If you experience issues saving data, please temporarily disable tracking protection or use a Chromium-based browser.',
        { duration: 15000 }
      );
    }
  });
</script>

<QueryClientProvider client={queryClient}>
  <TRPCProvider trpcClient={client} {queryClient}>
    <ModeWatcher />
    <div class="contaiiner mx-auto mb-12 max-w-5xl">
      <TopAppBar />
      <div class="mx-2 mt-4">
        <CookieCacheRefresh />
        {@render children()}
      </div>
    </div>
    <SvelteQueryDevtools initialIsOpen={false} />
    <Toaster position="top-right" richColors={true} />
  </TRPCProvider>
</QueryClientProvider>
<PostHogInit />
