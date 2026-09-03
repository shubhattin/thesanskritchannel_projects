<script lang="ts">
  import '../app.css';
  import '../styles/fonts.css';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import type { LayoutData } from './$types';
  import Header from '$components/Header.svelte';
  import Footer from '$components/Footer.svelte';
  import Posthog from '$components/Posthog.svelte';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';
  import { bootTheme } from '$lib/theme-runtime';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  $effect(() => {
    site_prefs.init(data.script_id, data.lang_id);
  });

  onMount(() => {
    bootTheme();
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
