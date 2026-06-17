<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { tick } from 'svelte';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import { client } from '~/api/client';
  import {
    get_node_at_path,
    get_project_from_id,
    EMPTY_PROJECT_REGISTRY,
    is_empty_list_branch
  } from '~/state/project_list';
  import { project_list_q_options } from '~/state/main_app/data.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Switch } from '$lib/components/ui/switch';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import SearchTextSelector from '~/components/search/SearchTextSelector.svelte';
  import SearchPathFilter from '~/components/search/SearchPathFilter.svelte';
  import SearchResultPathLabel from '~/components/search/SearchResultPathLabel.svelte';
  import SearchResultText from '~/components/search/SearchResultText.svelte';
  import {
    build_search_result_href,
    build_search_result_path_href
  } from '~/utils/search/search_result_link';
  import { normalize_search_path_prefixes } from '~/utils/search/search_path_prefixes';
  import type { SearchMode } from '~/utils/search/search_mode';
  import type { recursive_list_type } from '~/state/data_types';
  import { dbPathToPathParams } from '~/utils/map_path/swap';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineStop } from 'svelte-icons-pack/ai';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';

  let started = $state(false);
  let validation_error = $state<string | null>(null);

  let form_el: HTMLFormElement | null = null;

  let submitted_search_text = $state('');
  let submitted_project_keys = $state<string[]>([]);
  let submitted_path_prefixes = $state<number[][] | undefined>(undefined);
  let submitted_search_mode = $state<SearchMode>('text');

  let search_text = $state('');
  let search_mode = $state<SearchMode>('text');
  let selected_project_ids = $state<Set<number>>(new Set());
  let path_filter_text = $state('');
  let path_prefixes = $state<number[][] | undefined>(undefined);

  const LIMIT = 20;
  let offset = $state(0);

  const project_list_q = createQuery(() => project_list_q_options());

  const project_registry = $derived(project_list_q.data ?? EMPTY_PROJECT_REGISTRY);

  const get_project_key_from_id = (id: number) => get_project_from_id(id, project_registry)?.key;
  const get_project_name_from_id = (id: number) =>
    get_project_from_id(id, project_registry)?.name ?? `Project ${id}`;

  const selected_project_keys = $derived(
    [...selected_project_ids]
      .map((id) => get_project_key_from_id(id))
      .filter((k): k is string => !!k)
      .sort()
  );

  const can_search = $derived(selected_project_ids.size > 0);
  const show_result_project_names = $derived(submitted_project_keys.length !== 1);

  const get_result_map_node = (project_id: number, db_path: string) => {
    const map = result_project_maps.get(project_id);
    if (!map) return null;
    const path_params = db_path ? dbPathToPathParams(db_path) : [];
    return get_node_at_path(map, path_params);
  };

  let result_project_maps = $state<Map<number, recursive_list_type>>(new Map());

  const ensure_maps_for_results = async (project_ids: number[]) => {
    const missing = project_ids.filter((id) => !result_project_maps.has(id));
    if (missing.length === 0) return;
    const settled = await Promise.allSettled(
      missing.map(async (id) => {
        const map = await client.project.get_project_map.query({ project_id: id });
        return [id, map] as const;
      })
    );
    const next = new Map(result_project_maps);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        const [id, map] = result.value;
        next.set(id, map);
      }
    }
    result_project_maps = next;
  };

  const search_q = createQuery(() => ({
    queryKey: [
      'text_search',
      submitted_project_keys,
      submitted_path_prefixes,
      submitted_search_text,
      submitted_search_mode,
      offset,
      LIMIT
    ],
    enabled: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const q = submitted_search_text.trim();
      if (q.length < 1 || submitted_project_keys.length === 0) {
        return {
          items: [],
          page: { limit: LIMIT, offset, nextOffset: null, hasMore: false, totalCount: 0 }
        };
      }

      const path_prefixes_for_query = normalize_search_path_prefixes(submitted_path_prefixes);

      const result = await client.text.search_text_in_texts.query({
        project_keys: submitted_project_keys,
        search_text: q,
        mode: submitted_search_mode,
        limit: LIMIT,
        offset,
        ...(path_prefixes_for_query ? { path_prefixes: path_prefixes_for_query } : {})
      });

      const ids = [...new Set(result.items.map((row) => row.project_id))];
      await ensure_maps_for_results(ids);

      return result;
    }
  }));

  const submit_search = async (args?: { q?: string }) => {
    const q = (args?.q ?? search_text).trim();
    validation_error = null;

    if (selected_project_ids.size === 0) {
      validation_error = 'Select at least one text to search.';
      return;
    }

    if (q.length < 1) {
      started = false;
      validation_error = 'Type at least 1 character to search.';
      return;
    }

    started = true;
    offset = 0;
    submitted_search_text = q;
    submitted_project_keys = selected_project_keys;
    submitted_path_prefixes = normalize_search_path_prefixes(path_prefixes);
    submitted_search_mode = search_mode;

    is_submit_searching = true;
    try {
      await tick();
      await search_q.refetch();
    } finally {
      is_submit_searching = false;
    }
  };

  const go_to_page = async (pageNumber: number) => {
    if (!started) return;
    const nextOffset = Math.max(0, (pageNumber - 1) * LIMIT);
    offset = nextOffset;
    await tick();
    await search_q.refetch();
  };

  const go_to_offset = async (nextOffset: number) => {
    if (!started) return;
    offset = Math.max(0, nextOffset);
    await tick();
    await search_q.refetch();
  };

  const currentPage = $derived(Math.floor(offset / LIMIT) + 1);
  const totalPages = $derived(
    Math.max(0, Math.ceil(((search_q.data?.page.totalCount as number | undefined) ?? 0) / LIMIT))
  );
  const itemCount = $derived(search_q.data?.items.length ?? 0);
  const showingStart = $derived(itemCount === 0 ? 0 : started ? offset + 1 : 0);
  const showingEnd = $derived(itemCount === 0 ? 0 : offset + itemCount);

  let typing_enabled = $state(true);
  let is_submit_searching = $state(false);
  let ctx = $derived(createTypingContext('Devanagari'));
  $effect(() => {
    ctx.ready;
  });
</script>

<div class="space-y-6">
  <div class="space-y-2">
    <h1 class="text-3xl font-bold tracking-tight">Search</h1>
    <p class="text-muted-foreground">Search across Sanskrit texts.</p>
  </div>

  <div class="rounded-lg border bg-card p-6">
    <form
      id="search-form"
      class="space-y-4"
      bind:this={form_el}
      onsubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget as HTMLFormElement);
        submit_search({ q: String(fd.get('search_text') ?? '') });
      }}
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SearchTextSelector
          bind:selected_project_ids
          {project_registry}
          loading={project_list_q.isPending}
        />

        <SearchPathFilter {selected_project_ids} bind:path_prefixes bind:path_filter_text />
      </div>

      <div class="space-y-2">
        <Label class="text-sm font-medium">Search mode</Label>
        <RadioGroup.Root bind:value={search_mode} class="flex flex-row flex-wrap gap-4">
          <div class="flex items-center gap-2">
            <RadioGroup.Item value="text" id="search-mode-text" />
            <Label for="search-mode-text" class="cursor-pointer font-normal">Text Content</Label>
          </div>
          <div class="flex items-center gap-2">
            <RadioGroup.Item value="name" id="search-mode-name" />
            <Label for="search-mode-name" class="cursor-pointer font-normal">Name Search</Label>
          </div>
        </RadioGroup.Root>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <Label for="search-text" class="text-sm font-medium">
            {search_mode === 'name' ? 'Search name' : 'Search text'}
          </Label>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground select-none">Typing</span>
            <Switch checked={typing_enabled} onCheckedChange={(v) => (typing_enabled = v)} />
          </div>
        </div>
        <Input
          id="search-text"
          name="search_text"
          placeholder={search_mode === 'name' ? 'Search by Devanagari name…' : 'Type to search...'}
          bind:value={search_text}
          onbeforeinput={(e) =>
            handleTypingBeforeInputEvent(
              ctx,
              e,
              (newValue) => {
                search_text = newValue;
              },
              typing_enabled
            )}
          onblur={() => ctx.clearContext()}
          onkeydown={(e) => {
            clearTypingContextOnKeyDown(e, ctx);
            if (e.key === 'Enter') {
              e.preventDefault();
              form_el?.requestSubmit();
            }
          }}
        />
      </div>

      <div class="flex items-center justify-between gap-3 pt-2">
        <div class="text-sm">
          {#if validation_error}
            <span class="text-destructive">{validation_error}</span>
          {:else if !can_search}
            <span class="text-muted-foreground">Select at least one text to search</span>
          {:else if is_submit_searching}
            <span class="text-muted-foreground">Searching…</span>
          {:else}
            <span class="text-muted-foreground">&nbsp;</span>
          {/if}
        </div>
        <Button type="submit" disabled={!can_search || is_submit_searching}>
          {is_submit_searching ? 'Searching…' : 'Search'}
        </Button>
      </div>
    </form>
  </div>

  <div class="space-y-4">
    <div class="flex items-center justify-between border-b pb-3">
      <h2 class="text-xl font-semibold">Results</h2>
      <div class="text-sm text-muted-foreground">
        {#if started}
          {#if search_q.data}
            <span
              >{search_q.data.items.length} result{search_q.data.items.length !== 1 ? 's' : ''} on this
              page</span
            >
          {:else if is_submit_searching}
            <span class="animate-pulse">Searching…</span>
          {/if}
        {:else}
          <span>Enter a query to start</span>
        {/if}
      </div>
    </div>

    {#if started && (search_q.data || search_q.isSuccess)}
      <div
        class="flex flex-col items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3 sm:flex-row"
      >
        <div class="text-sm text-muted-foreground">
          {#if totalPages > 0}
            <span class="font-medium">Page {currentPage} of {totalPages}</span>
          {:else}
            <span class="font-medium">Page {currentPage}</span>
          {/if}
          {#if search_q.data}
            <span class="mx-2 opacity-50">•</span>
            <span>
              Showing {showingStart}-{showingEnd}
              {#if search_q.data.page.totalCount}
                of <span class="font-medium">{search_q.data.page.totalCount}</span>
              {/if}
            </span>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset === 0 || search_q.isFetching}
            onclick={() => go_to_offset(offset - LIMIT)}
          >
            Prev
          </Button>
          {#if totalPages > 0}
            <Select.Root
              type="single"
              value={currentPage.toString()}
              onValueChange={(v) => {
                const p = parseInt(v);
                if (Number.isFinite(p)) go_to_page(p);
              }}
              disabled={search_q.isFetching}
            >
              <Select.Trigger class="w-28" aria-label="Jump to page">
                Page {currentPage}
              </Select.Trigger>
              <Select.Content>
                {#each Array(totalPages) as _, idx (idx)}
                  <Select.Item value={(idx + 1).toString()} label={`Page ${idx + 1}`} />
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={search_q.isFetching ||
              (totalPages > 0 ? currentPage >= totalPages : !search_q.data?.page.hasMore)}
            onclick={() => go_to_offset(search_q.data?.page.nextOffset ?? offset + LIMIT)}
          >
            Next
          </Button>
        </div>
      </div>
    {/if}

    <Tooltip.Provider>
      <div class="min-h-[60vh]">
        {#if !started}
          <div class="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <div class="text-center text-muted-foreground">
              <p class="text-sm">Enter a query and click Search to begin</p>
            </div>
          </div>
        {:else if is_submit_searching && search_q.isFetching}
          <div class="space-y-3">
            {#each Array(6) as _, i (i)}
              <div class="rounded-lg border bg-card p-4">
                <Skeleton class="h-4 w-32 bg-muted" />
                <Skeleton class="mt-3 h-4 w-full bg-muted" />
                <Skeleton class="mt-2 h-4 w-4/5 bg-muted" />
              </div>
            {/each}
          </div>
        {:else if search_q.isError}
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div class="font-semibold text-destructive">Search failed</div>
            <div class="mt-1 text-sm text-destructive/80">{String(search_q.error)}</div>
          </div>
        {:else if search_q.data || search_q.isSuccess}
          {#if search_q.data.items.length === 0}
            <div class="flex h-64 items-center justify-center rounded-lg border">
              <div class="text-center text-muted-foreground">
                <p class="text-sm">No results found</p>
                <p class="mt-1 text-xs">Try adjusting your search query or filters</p>
              </div>
            </div>
          {:else}
            <div class="space-y-3">
              {#each search_q.data.items as row (row.project_id + ':' + row.path + ':' + (row.index ?? 'name'))}
                {@const project_key = get_project_key_from_id(row.project_id)}
                {@const is_name_mode = submitted_search_mode === 'name'}
                {@const result_map_node = is_name_mode
                  ? get_result_map_node(row.project_id, row.path)
                  : null}
                {@const show_leaf_icon =
                  is_name_mode && result_map_node != null && is_empty_list_branch(result_map_node)}
                {@const result_href =
                  project_key != null
                    ? is_name_mode
                      ? build_search_result_path_href(project_key, row.path)
                      : row.index != null
                        ? build_search_result_href(project_key, row.path, row.index)
                        : null
                    : null}
                <div class="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
                  <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {#if show_result_project_names}
                      <span class="rounded-md bg-muted px-2 py-0.5"
                        >{get_project_name_from_id(row.project_id)}</span
                      >
                    {/if}
                    <SearchResultPathLabel
                      map={result_project_maps.get(row.project_id)}
                      db_path={row.path}
                    />
                    {#if !is_name_mode && row.shloka_num}
                      <span class="rounded-md bg-muted px-2 py-0.5">Shloka {row.shloka_num}</span>
                    {/if}
                    {#if result_href}
                      <a
                        href={result_href}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
                        title={is_name_mode
                          ? 'Open path (new tab)'
                          : `Open at line ${row.index} (new tab)`}
                      >
                        <ExternalLink class="size-3" aria-hidden="true" />
                        <span>{is_name_mode ? 'Open path' : `Line ${row.index}`}</span>
                      </a>
                    {/if}
                    {#if show_leaf_icon}
                      <span
                        class="inline-flex items-center rounded-md bg-muted px-2 py-0.5"
                        title="List node with no children"
                      >
                        <Icon class="size-3.5 opacity-70" src={AiOutlineStop} />
                        <span class="sr-only">List node with no children</span>
                      </span>
                    {/if}
                  </div>
                  <div class="text-sm leading-relaxed whitespace-pre-wrap">
                    <SearchResultText text={row.text} query={submitted_search_text} />
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="flex h-64 items-center justify-center rounded-lg border">
            <div class="text-center text-muted-foreground">
              <p class="text-sm">Ready to search</p>
            </div>
          </div>
        {/if}
      </div>
    </Tooltip.Provider>
  </div>
</div>
