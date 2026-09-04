<script lang="ts">
  import '../app.css';
  import '../styles/fonts.css';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { onNavigate } from '$app/navigation';
  import type { LayoutData } from './$types';
  import Header from '$components/Header.svelte';
  import Footer from '$components/Footer.svelte';
  import Posthog from '$components/Posthog.svelte';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';
  import { bootTheme } from '$lib/theme-runtime';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  // this will run the first and initialize the state, avoid the -1 for lang_id
  // svelte-ignore state_referenced_locally
  site_prefs.init(data.script_id, data.lang_id);

  onMount(() => {
    bootTheme();
  });

  // Same-document page crossfade (Astro ClientRouter–style progressive enhancement).
  // https://svelte.dev/blog/view-transitions
  onNavigate((navigation) => {
    const startViewTransition = document.startViewTransition?.bind(document);
    if (!startViewTransition) return;

    return new Promise((resolve) => {
      startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<svelte:head>
  <meta name="theme-color" content="#f7f2eb" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Oxanium:wght@400;500;600;700&display=swap"
    rel="stylesheet"
    fetchpriority="high"
  />
</svelte:head>

<a href="#main-content" class="skip-link">Skip to Main Content</a>

<div class="flex min-h-screen flex-col">
  <Header />

  <main id="main-content" class="flex-1" tabindex="-1">
    {@render children()}
  </main>

  <Footer />
</div>

<Posthog />

<style>
  /* Soft root crossfade — header/footer use separate transition names so chrome stays put. */
  @keyframes vt-fade-in {
    from {
      opacity: 0;
    }
  }

  @keyframes vt-fade-out {
    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    :root::view-transition-old(root) {
      animation: 90ms cubic-bezier(0.4, 0, 1, 1) both vt-fade-out;
    }

    :root::view-transition-new(root) {
      animation: 210ms cubic-bezier(0, 0, 0.2, 1) 90ms both vt-fade-in;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(::view-transition-group(*)),
    :global(::view-transition-old(*)),
    :global(::view-transition-new(*)) {
      animation: none !important;
    }
  }
</style>
