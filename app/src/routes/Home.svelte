<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import UserControls from '~/components/pages/main_app/user/UserControls.svelte';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import PenLine from '@lucide/svelte/icons/pen-line';
  import Search from '@lucide/svelte/icons/search';
  import Button from '~/lib/components/ui/button/button.svelte';
  import { useSession } from '~/lib/auth-client';
  import { useTRPC } from '~/api/client';
  import { APP_SCOPE_ID_PROJECT_PORTAL, APP_SCOPE_ID_LEKHA } from '~/state/data_types';
  import { Skeleton } from '~/lib/components/ui/skeleton';
  import HomePageProjectList from '~/components/pages/main_app/HomePageProjectList.svelte';

  const session = useSession();
  const trpc = useTRPC();

  const is_admin = $derived($session.data?.user.role === 'admin');
  let list_scopes_q = createQuery(() =>
    trpc.user.list_user_app_scopes.queryOptions(
      { user_id: $session.data?.user.id ?? '' },
      {
        enabled: !is_admin
      }
    )
  );
  let is_scope_loading = $derived(is_admin ? false : list_scopes_q.isFetching);
  const main_origin = String(import.meta.env.VITE_MAIN_SITE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
</script>

<MetaTags
  title="Admin Portal | The Sanskrit Channel"
  description="Portal to manage all content on the Sanskrit Channel Site"
/>

<main class="container mx-auto px-4 py-8">
  <div class="-mb-4 flex justify-end">
    <UserControls />
  </div>
  <h1 class="mb-8 text-center text-2xl font-bold">The Sanskrit Channel Projects</h1>

  {#if is_scope_loading}
    <div class="flex justify-center">
      <Skeleton class="h-10 w-full" />
    </div>
  {:else if !is_admin && list_scopes_q.isError}
    <div
      class="mx-auto max-w-xl rounded-xl border border-border bg-card px-6 py-6 text-center text-card-foreground shadow-sm"
      role="alert"
    >
      <p class="text-sm text-destructive">Failed to load your portal permissions.</p>
      <button
        class="mt-3 rounded-md bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/80"
        onclick={() => list_scopes_q.refetch()}
      >
        Retry
      </button>
    </div>
  {:else if is_admin || (list_scopes_q.isSuccess && list_scopes_q.data.scopes.includes(APP_SCOPE_ID_PROJECT_PORTAL))}
    <HomePageProjectList />
  {:else}
    <div
      class="mx-auto max-w-xl rounded-xl border border-border bg-card px-6 py-6 text-center text-card-foreground shadow-sm"
      role="status"
      aria-live="polite"
    >
      <h2 class="text-lg font-semibold tracking-tight text-foreground">
        You are not authorized for the Projects Portal
      </h2>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
        Translating or editing texts in this portal needs Projects Portal scope. Explore published
        projects anytime on the main site homepage.
      </p>
      <p class="mt-5">
        {#if main_origin}
          <a
            href={`${main_origin}/`}
            class="inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/90"
            target="_blank"
            rel="noopener noreferrer"
          >
            Go to the main site home
            <span class="sr-only">(opens in a new tab)</span>
          </a>
          <span class="mt-1 block font-mono text-xs text-muted-foreground">/</span>
        {:else}
          <span class="text-sm text-muted-foreground">Main site link unavailable.</span>
        {/if}
      </p>
    </div>
  {/if}

  {#if is_admin}
    <div class="mt-8 flex justify-center">
      <a
        href="/search"
        class="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 text-base font-semibold tracking-wide text-primary transition hover:border-secondary hover:bg-muted/70 focus-visible:ring focus-visible:ring-ring/70 focus-visible:outline-none"
        aria-label="Search across Sanskrit texts"
      >
        <Search class="size-5 shrink-0" aria-hidden="true" />
        <span>Search across texts</span>
      </a>
    </div>
  {/if}
  {#if is_scope_loading}
    <div class="mt-4 flex justify-center">
      <Skeleton class="h-10 w-full" />
    </div>
  {:else if !is_admin && list_scopes_q.isError}
    <div
      class="mx-auto mt-6 max-w-xl rounded-xl border border-border bg-card px-6 py-6 text-center text-card-foreground shadow-sm"
      role="alert"
    >
      <p class="text-sm text-destructive">Failed to load your Lekha permissions.</p>
      <button
        class="mt-3 rounded-md bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/80"
        onclick={() => list_scopes_q.refetch()}
      >
        Retry
      </button>
    </div>
  {:else if is_admin || (list_scopes_q.isSuccess && list_scopes_q.data.scopes.includes(APP_SCOPE_ID_LEKHA))}
    <div class="mt-4 flex justify-center">
      <a href="/lekha" aria-label="Browse Lekha writings">
        <Button variant="outline" size="lg">
          <PenLine class="size-5 shrink-0" aria-hidden="true" />
          <span>Lekha</span>
        </Button>
      </a>
    </div>
  {:else}
    <div
      class="mx-auto mt-6 max-w-xl rounded-xl border border-border bg-card px-6 py-6 text-center text-card-foreground shadow-sm"
      role="status"
      aria-live="polite"
    >
      <h2 class="text-lg font-semibold tracking-tight text-foreground">
        You are not authorized for Lekha in this portal
      </h2>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
        Publishing and admin tasks here require Lekha access. You can still read Lekha on the main
        site.
      </p>
      <p class="mt-5">
        {#if main_origin}
          <a
            href={`${main_origin}/lekha`}
            class="inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/90"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Lekha on the main site
            <span class="sr-only">(opens in a new tab)</span>
          </a>
          <span class="mt-1 block font-mono text-xs text-muted-foreground">/lekha</span>
        {:else}
          <span class="text-sm text-muted-foreground">Main site link unavailable.</span>
        {/if}
      </p>
    </div>
  {/if}
</main>
