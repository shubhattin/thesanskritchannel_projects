<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { useTRPC } from '~/api/client';
  import * as InputGroup from '$lib/components/ui/input-group';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import SearchIcon from '@lucide/svelte/icons/search';
  import KeyboardIcon from '@lucide/svelte/icons/keyboard';
  import Pencil from '@lucide/svelte/icons/pencil';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import ListX from '@lucide/svelte/icons/list-x';
  import Rows3 from '@lucide/svelte/icons/rows-3';
  import Calendar from '@lucide/svelte/icons/calendar';
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import ArrowDownWideNarrow from '@lucide/svelte/icons/arrow-down-wide-narrow';
  import ArrowUpNarrowWide from '@lucide/svelte/icons/arrow-up-narrow-wide';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import { withPaginationListScroll } from '$lib/pagination-scroll';
  import { Debounced } from 'runed';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import { build_main_site_lekha_href } from '~/utils/main_site_url';

  let { draft }: { draft: boolean } = $props();
  const trpc = useTRPC();

  let page = $state(1);
  let list_el = $state<HTMLElement | null>(null);
  const list_ref = {
    get current() {
      return list_el;
    }
  };
  const change_page = withPaginationListScroll((next) => {
    page = next;
  }, list_ref);
  let submitted_search = $state('');
  let sort_by = $state<'published_at' | 'updated_at'>('published_at');
  let order_by = $state<'asc' | 'desc'>('desc');
  let limit = $state(15);
  let typing_enabled = $state(false);

  const PAGE_SIZE_OPTIONS = [15, 25, 50] as const;

  let search_input = $state('');

  const typing_ctx = createTypingContext('Devanagari', {
    includeInherentVowel: true
  });

  const debounced_search = new Debounced(() => search_input.trim(), 350);

  $effect(() => {
    const q = debounced_search.current;
    if (q === submitted_search) return;
    submitted_search = q;
    page = 1;
  });

  let list_q = createQuery(() =>
    trpc.site.lekha.list_lekhas.queryOptions({
      draft,
      page,
      limit,
      search_text: submitted_search,
      sort_by,
      order_by
    })
  );

  /** Immediate search (Enter / Search button); debounce covers typing. */
  const apply_search = () => {
    const q = search_input.trim();
    if (q === submitted_search) return;
    submitted_search = q;
    page = 1;
  };

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }

  function formatLekhaDate(d: string | Date | null | undefined) {
    if (d == null) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-3">
    <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <InputGroup.Root class="h-10 w-full min-w-0 flex-1">
        <InputGroup.Addon align="inline-start" class="pl-2.5">
          <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
        </InputGroup.Addon>
        <InputGroup.Input
          placeholder="Search titles, descriptions, and tags…"
          bind:value={search_input}
          onbeforeinput={(e) =>
            handleTypingBeforeInputEvent(
              typing_ctx,
              e,
              (newValue) => {
                search_input = newValue;
              },
              typing_enabled
            )}
          onblur={() => typing_ctx.clearContext()}
          onkeydown={(e) => {
            if (toggle_typing_from_keyboard(e)) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              apply_search();
              return;
            }
            clearTypingContextOnKeyDown(e, typing_ctx);
          }}
          aria-label="Search lekha"
        />
        <InputGroup.Addon
          align="inline-end"
          class="cursor-default gap-2 border-s border-border/50 ps-3 pe-2.5"
        >
          <Label
            for="lekha-admin-list-typing"
            class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground select-none"
          >
            <KeyboardIcon class="size-3.5" aria-hidden="true" />
            Typing
          </Label>
          <Switch
            id="lekha-admin-list-typing"
            bind:checked={typing_enabled}
            title="Devanagari transliteration typing (Alt+X)"
          />
        </InputGroup.Addon>
      </InputGroup.Root>
      <Button
        type="button"
        variant="secondary"
        class="h-10 shrink-0 gap-1.5 sm:w-auto"
        onclick={apply_search}
      >
        <SearchIcon class="size-3.5" aria-hidden="true" />
        Search
      </Button>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <Label for="lekha-admin-per-page" class="text-xs font-medium text-muted-foreground">
          Per page
        </Label>
        <Select.Root
          type="single"
          value={String(limit)}
          onValueChange={(v) => {
            const n = Number(v);
            if (PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) {
              limit = n;
              page = 1;
            }
          }}
        >
          <Select.Trigger
            id="lekha-admin-per-page"
            class="h-8 w-24 gap-1.5 text-xs"
            aria-label="Posts per page"
          >
            <Rows3 class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {limit}
          </Select.Trigger>
          <Select.Content>
            {#each PAGE_SIZE_OPTIONS as size (size)}
              <Select.Item value={String(size)}>{size}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="lekha-admin-sort-by" class="text-xs font-medium text-muted-foreground">
          Sort by
        </Label>
        <Select.Root
          type="single"
          value={sort_by}
          onValueChange={(v) => {
            if (v === 'published_at' || v === 'updated_at') {
              sort_by = v;
              page = 1;
            }
          }}
        >
          <Select.Trigger
            id="lekha-admin-sort-by"
            class="h-8 w-40 gap-1.5 text-xs"
            aria-label="Sort by"
          >
            {#if sort_by === 'published_at'}
              <Calendar class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              Published
            {:else}
              <CalendarClock class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              Updated
            {/if}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="published_at" label="Published">
              <span class="flex items-center gap-2">
                <Calendar class="size-3.5 text-muted-foreground" aria-hidden="true" />
                Published
              </span>
            </Select.Item>
            <Select.Item value="updated_at" label="Updated">
              <span class="flex items-center gap-2">
                <CalendarClock class="size-3.5 text-muted-foreground" aria-hidden="true" />
                Updated
              </span>
            </Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="lekha-admin-order" class="text-xs font-medium text-muted-foreground">
          Order
        </Label>
        <Select.Root
          type="single"
          value={order_by}
          onValueChange={(v) => {
            if (v === 'asc' || v === 'desc') {
              order_by = v;
              page = 1;
            }
          }}
        >
          <Select.Trigger
            id="lekha-admin-order"
            class="h-8 w-36 gap-1.5 text-xs"
            aria-label="Order"
          >
            {#if order_by === 'desc'}
              <ArrowDownWideNarrow
                class="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              Newest first
            {:else}
              <ArrowUpNarrowWide
                class="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              Oldest first
            {/if}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="desc" label="Newest first">
              <span class="flex items-center gap-2">
                <ArrowDownWideNarrow class="size-3.5 text-muted-foreground" aria-hidden="true" />
                Newest first
              </span>
            </Select.Item>
            <Select.Item value="asc" label="Oldest first">
              <span class="flex items-center gap-2">
                <ArrowUpNarrowWide class="size-3.5 text-muted-foreground" aria-hidden="true" />
                Oldest first
              </span>
            </Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
    </div>
  </div>

  {#if list_q.isFetching}
    <div class="space-y-2">
      {#each Array(4) as _, i (i)}
        <Skeleton class="h-20 w-full rounded-lg" />
      {/each}
    </div>
  {:else if list_q.isError}
    <p class="text-sm text-destructive">{String(list_q.error)}</p>
  {:else if list_q.data}
    <p class="text-xs text-muted-foreground">
      {list_q.data.total} post{list_q.data.total !== 1 ? 's' : ''} · Page {list_q.data.page} of
      {list_q.data.pageCount}
    </p>
    <ul class="flex flex-col gap-1.5" bind:this={list_el}>
      {#each list_q.data.list as row (row.id)}
        <li
          class="flex flex-col gap-2 rounded-md border border-border/80 bg-card p-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-start justify-between gap-2">
              <h3 class="min-w-0 flex-1 truncate leading-tight font-medium">{row.title}</h3>
              <div
                class="flex shrink-0 items-center gap-0.5 text-muted-foreground sm:gap-1"
                aria-label="Site visibility"
              >
                {#if row.listed}
                  <span
                    class="inline-flex rounded-md p-0.5 text-primary"
                    title="Listed on the site"
                    role="img"
                    aria-label="Listed on the site"
                  >
                    <ListChecks class="size-4" aria-hidden="true" />
                  </span>
                {:else}
                  <span
                    class="inline-flex rounded-md p-0.5 opacity-80"
                    title="Not listed (hidden from public list)"
                    role="img"
                    aria-label="Not listed on the site"
                  >
                    <ListX class="size-4" aria-hidden="true" />
                  </span>
                {/if}
              </div>
            </div>
            <p class="line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
            {#if row.tags?.length}
              <div class="flex flex-wrap gap-1 pt-1">
                {#each row.tags as tag (tag)}
                  <span class="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >{tag}</span
                  >
                {/each}
              </div>
            {/if}
            <p class="text-xs text-muted-foreground">
              Published {formatLekhaDate(row.published_at)} · Updated {formatLekhaDate(
                row.updated_at
              )}
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            {#if !row.draft && row.url_slug}
              {@const main_href = build_main_site_lekha_href(row.url_slug)}
              {#if main_href}
                <Button
                  variant="ghost"
                  size="sm"
                  class="shrink-0 gap-1"
                  href={main_href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink class="size-3.5" aria-hidden="true" />
                  View
                  <span class="sr-only">(opens on main site in a new tab)</span>
                </Button>
              {/if}
            {/if}
            <Button variant="outline" size="sm" class="shrink-0 gap-1" href="/lekha/edit/{row.id}">
              <Pencil class="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          </div>
        </li>
      {/each}
    </ul>
    {#if list_q.data.list.length === 0}
      <p class="py-8 text-center text-sm text-muted-foreground">No posts in this view.</p>
    {/if}
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!list_q.data.hasPrev}
        onclick={() => change_page(list_q.data!.page - 1)}
      >
        Previous
      </Button>
      <span class="text-xs text-muted-foreground">
        Page {list_q.data.page} / {list_q.data.pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!list_q.data.hasNext}
        onclick={() => change_page(list_q.data!.page + 1)}
      >
        Next
      </Button>
    </div>
  {/if}
</div>
