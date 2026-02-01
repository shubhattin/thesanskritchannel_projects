<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { tick } from 'svelte';
  import { client } from '~/api/client';
  import { PROJECT_LIST } from '~/state/project_list';
  import { queryClient } from '~/state/queryClient';
  import { cl_join } from '~/tools/cl_join';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Switch } from '$lib/components/ui/switch';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';

  let started = $state(false);
  let validation_error = $state<string | null>(null);

  let form_el: HTMLFormElement | null = null;

  let submitted_search_text = $state('');
  let submitted_project_id = $state<number>(0);
  let submitted_path_filter = $state('');

  let search_text = $state('');
  let path_filter = $state('');
  let project_id = $state(0);

  const LIMIT = 20;
  let offset = $state(0);

  const parse_path_params = (t: string): number[] | undefined => {
    const matches = t.match(/\d+/g);
    if (!matches || matches.length === 0) return undefined;
    const nums = matches.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n));
    return nums.length ? nums : undefined;
  };

  const get_project_key_from_id = (id: number) => PROJECT_LIST.find((p) => p.id === id)?.key;
  const get_project_name_from_id = (id: number) =>
    PROJECT_LIST.find((p) => p.id === id)?.name ?? `Project ${id}`;

  const search_q = $derived(
    createQuery(
      {
        queryKey: [
          'text_search',
          submitted_project_id === 0 ? undefined : submitted_project_id,
          submitted_path_filter,
          submitted_search_text,
          offset,
          LIMIT
        ],
        enabled: false,
        placeholderData: (prev) => prev,
        queryFn: async () => {
          const q = submitted_search_text.trim();
          if (q.length < 3) {
            return {
              items: [],
              page: { limit: LIMIT, offset, nextOffset: null, hasMore: false, totalCount: 0 }
            };
          }

          const project_key = get_project_key_from_id(submitted_project_id);
          const path_params = parse_path_params(submitted_path_filter);

          return await client.text.search_text_in_texts.query({
            project_key,
            path_params,
            search_text: q,
            limit: LIMIT,
            offset
          });
        }
      },
      queryClient
    )
  );

  const submit_search = async (args?: {
    q?: string;
    project_id?: number;
    path_filter?: string;
  }) => {
    const q = (args?.q ?? search_text).trim();
    validation_error = null;

    if (q.length < 3) {
      started = false;
      validation_error = 'Type at least 3 characters to search.';
      return;
    }

    started = true;
    offset = 0;
    submitted_search_text = q;
    submitted_project_id = args?.project_id ?? project_id;
    submitted_path_filter = args?.path_filter ?? path_filter;

    // ensure query key updates before refetch
    await tick();
    await $search_q.refetch();
  };

  const go_to_page = async (pageNumber: number) => {
    if (!started) return;
    const nextOffset = Math.max(0, (pageNumber - 1) * LIMIT);
    offset = nextOffset;
    await tick();
    await $search_q.refetch();
  };

  const go_to_offset = async (nextOffset: number) => {
    if (!started) return;
    offset = Math.max(0, nextOffset);
    await tick();
    await $search_q.refetch();
  };

  const currentPage = $derived(Math.floor(offset / LIMIT) + 1);
  const totalPages = $derived(
    Math.max(0, Math.ceil((($search_q.data?.page.totalCount as number | undefined) ?? 0) / LIMIT))
  );
  const showingStart = $derived(started ? offset + 1 : 0);
  const showingEnd = $derived(offset + ($search_q.data?.items.length ?? 0));

  // Lipi-Lekhika typing (Sanskrit / Devanagari)
  let typing_enabled = $state(true);
  let ctx = $derived(
    createTypingContext('Devanagari', {
      includeInherentVowel: true
    })
  );
  $effect(() => {
    ctx.ready;
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="space-y-2">
    <h1 class="text-3xl font-bold tracking-tight">Search</h1>
    <p class="text-muted-foreground">Search across Sanskrit texts.</p>
  </div>

  <!-- Search Form -->
  <div class="rounded-lg border bg-card p-6">
    <form
      class="space-y-4"
      bind:this={form_el}
      onsubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget as HTMLFormElement);
        submit_search({
          q: String(fd.get('search_text') ?? ''),
          project_id: Number(fd.get('project_id') ?? project_id),
          path_filter: String(fd.get('path_filter') ?? '')
        });
      }}
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label for="project-select" class="text-sm font-medium">Project</Label>
          <Select.Root
            type="single"
            value={project_id.toString()}
            onValueChange={(v) => {
              project_id = parseInt(v) || 0;
            }}
          >
            <Select.Trigger id="project-select" class="w-full">
              {PROJECT_LIST.find((p) => p.id === project_id)?.name ?? 'All'}
            </Select.Trigger>
            <Select.Content>
              {#each PROJECT_LIST as project (project.id)}
                <Select.Item value={project.id.toString()} label={project.name} />
              {/each}
              <Select.Item value="0" label="All" />
            </Select.Content>
          </Select.Root>
          <input type="hidden" name="project_id" value={project_id} />
        </div>

        <div class="space-y-2">
          <Label for="path-filter" class="text-sm font-medium">Path filter</Label>
          <Input
            id="path-filter"
            name="path_filter"
            placeholder="e.g. 1:2"
            bind:value={path_filter}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                form_el?.requestSubmit();
              }
            }}
          />
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <Label for="search-text" class="text-sm font-medium">Search text</Label>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground select-none">Typing</span>
            <Switch checked={typing_enabled} onCheckedChange={(v) => (typing_enabled = v)} />
          </div>
        </div>
        <Input
          id="search-text"
          name="search_text"
          placeholder="Type to search..."
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
          {:else if started && $search_q.isFetching}
            <span class="text-muted-foreground">Searching…</span>
          {:else}
            <span class="text-muted-foreground">&nbsp;</span>
          {/if}
        </div>
        <Button type="submit" disabled={$search_q.isFetching}>
          {$search_q.isFetching ? 'Searching…' : 'Search'}
        </Button>
      </div>
    </form>
  </div>

  <!-- Results Section -->
  <div class="space-y-4">
    <div class="flex items-center justify-between border-b pb-3">
      <h2 class="text-xl font-semibold">Results</h2>
      <div class="text-sm text-muted-foreground">
        {#if started}
          {#if $search_q.isFetching}
            <span class="animate-pulse">Loading...</span>
          {:else if $search_q.isSuccess}
            <span
              >{$search_q.data.items.length} result{$search_q.data.items.length !== 1 ? 's' : ''} on this
              page</span
            >
          {/if}
        {:else}
          <span>Enter a query to start</span>
        {/if}
      </div>
    </div>

    {#if started && ($search_q.data || $search_q.isSuccess)}
      <div
        class="flex flex-col items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3 sm:flex-row"
      >
        <div class="text-sm text-muted-foreground">
          {#if totalPages > 0}
            <span class="font-medium">Page {currentPage} of {totalPages}</span>
          {:else}
            <span class="font-medium">Page {currentPage}</span>
          {/if}
          {#if $search_q.data}
            <span class="mx-2 opacity-50">•</span>
            <span>
              Showing {showingStart}-{showingEnd}
              {#if $search_q.data.page.totalCount}
                of <span class="font-medium">{$search_q.data.page.totalCount}</span>
              {/if}
            </span>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset === 0 || $search_q.isFetching}
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
              disabled={$search_q.isFetching}
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
            disabled={$search_q.isFetching ||
              (totalPages > 0 ? currentPage >= totalPages : !$search_q.data?.page.hasMore)}
            onclick={() => go_to_offset($search_q.data?.page.nextOffset ?? offset + LIMIT)}
          >
            Next
          </Button>
        </div>
      </div>
    {/if}

    <div class="min-h-[60vh]">
      {#if !started}
        <div class="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <div class="text-center text-muted-foreground">
            <p class="text-sm">Enter a query and click Search to begin</p>
          </div>
        </div>
      {:else if $search_q.isFetching}
        <div class="space-y-3">
          {#each Array(6) as _, i (i)}
            <div class="rounded-lg border bg-card p-4">
              <Skeleton class="h-4 w-32 bg-muted" />
              <Skeleton class="mt-3 h-4 w-full bg-muted" />
              <Skeleton class="mt-2 h-4 w-4/5 bg-muted" />
            </div>
          {/each}
        </div>
      {:else if $search_q.isError}
        <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div class="font-semibold text-destructive">Search failed</div>
          <div class="mt-1 text-sm text-destructive/80">{String($search_q.error)}</div>
        </div>
      {:else if $search_q.isSuccess}
        {#if $search_q.data.items.length === 0}
          <div class="flex h-64 items-center justify-center rounded-lg border">
            <div class="text-center text-muted-foreground">
              <p class="text-sm">No results found</p>
              <p class="mt-1 text-xs">Try adjusting your search query or filters</p>
            </div>
          </div>
        {:else}
          <div class="space-y-3">
            {#each $search_q.data.items as row (row.project_id + ':' + row.path + ':' + row.index)}
              <div class="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
                <div class="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span class="rounded-md bg-muted px-2 py-0.5"
                    >{get_project_name_from_id(row.project_id)}</span
                  >
                  <span class="rounded-md bg-muted px-2 py-0.5">Path {row.path}</span>
                  <span class="rounded-md bg-muted px-2 py-0.5">Index {row.index}</span>
                  {#if row.shloka_num}
                    <span class="rounded-md bg-muted px-2 py-0.5">Shloka {row.shloka_num}</span>
                  {/if}
                </div>
                <div class="text-sm leading-relaxed whitespace-pre-wrap">{row.text}</div>
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
  </div>
</div>
