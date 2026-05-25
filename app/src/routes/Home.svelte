<script lang="ts">
  import UserControls from '~/components/pages/main_app/user/UserControls.svelte';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import PenLine from '@lucide/svelte/icons/pen-line';
  import Search from '@lucide/svelte/icons/search';
  import { PROJECT_LIST } from '~/state/project_list';
  import Button from '~/lib/components/ui/button/button.svelte';
  import { user_info } from '~/state/user.svelte';
  import { client_q } from '~/api/client';
  import { APP_SCOPE_ID_PROJECT_PORTAL, APP_SCOPE_ID_LEKHA } from '~/state/data_types';
  import { Skeleton } from '~/lib/components/ui/skeleton';

  const is_admin = $derived($user_info?.role === 'admin');
  let list_scopes_q = $derived(
    client_q.user.list_user_app_scopes.query(
      { user_id: $user_info?.id ?? '' },
      {
        enabled: is_admin
      }
    )
  );
  let is_scope_loading = $derived(is_admin ? false : $list_scopes_q.isFetching);
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
  {:else if is_admin || ($list_scopes_q.isSuccess && $list_scopes_q.data.scopes.includes(APP_SCOPE_ID_PROJECT_PORTAL))}
    <div class="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
      {#each PROJECT_LIST as project}
        <a
          href={'/' + project.key}
          class="btn group block rounded-lg border border-border bg-card p-6 shadow-md transition duration-200 ease-out hover:-translate-y-1 hover:border-secondary hover:bg-muted/20 hover:shadow-lg focus-visible:ring focus-visible:ring-ring/70 focus-visible:outline-none"
        >
          <h2 class="mb-2 text-xl font-semibold">
            {project.name}
            <div class="text-base text-muted-foreground">{project.name_dev}</div>
          </h2>
          <p class="mb-4 text-sm text-muted-foreground">{project.description}</p>
          <div
            class="flex items-center text-primary transition-colors duration-200 group-hover:text-secondary-foreground"
          >
            <span>Explore</span>
            <ArrowRight class="ml-2 size-4" aria-hidden="true" />
          </div>
        </a>
      {/each}
    </div>
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
  {:else if is_admin || ($list_scopes_q.isSuccess && $list_scopes_q.data.scopes.includes(APP_SCOPE_ID_LEKHA))}
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
      </p>
    </div>
  {/if}
</main>
