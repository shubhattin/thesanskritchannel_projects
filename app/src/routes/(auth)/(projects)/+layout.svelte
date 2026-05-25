<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const is_projects_scope_allowed = $derived(data.is_projects_scope_allowed);

  const main_site_origin = (
    typeof import.meta.env.VITE_MAIN_SITE_URL === 'string'
      ? import.meta.env.VITE_MAIN_SITE_URL.trim()
      : ''
  ).replace(/\/+$/, '');
  const main_site_home_href = main_site_origin ? `${main_site_origin}/` : '';
</script>

{#if is_projects_scope_allowed}
  {@render children()}
{:else}
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10"
    role="status"
    aria-live="polite"
  >
    <div
      class="w-full max-w-md rounded-xl border border-border bg-card px-8 py-10 text-center text-card-foreground shadow-sm"
    >
      <h1 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        You are not authorized for the Projects Portal
      </h1>
      <p class="mt-4 text-sm leading-relaxed text-muted-foreground">
        Translating or editing texts in this portal needs Projects Portal scope. Explore published
        projects anytime on the main site homepage.
      </p>
      {#if main_site_origin}
        <p class="mt-6">
          <a
            href={main_site_home_href}
            class="inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/90"
            target="_blank"
            rel="noopener noreferrer"
          >
            Go to the main site home
            <span class="sr-only">(opens in a new tab)</span>
          </a>
          <span class="mt-1 block font-mono text-xs text-muted-foreground">/</span>
        </p>
      {/if}
    </div>
  </div>
{/if}
