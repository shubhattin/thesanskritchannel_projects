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
        queryFn: async () => {
          const q = submitted_search_text.trim();
          if (q.length < 3) {
            return {
              items: [],
              page: { limit: LIMIT, offset, nextOffset: null, hasMore: false }
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

  const go_to_offset = async (nextOffset: number) => {
    if (!started) return;
    offset = Math.max(0, nextOffset);
    await tick();
    await $search_q.refetch();
  };
</script>

<div
  class={cl_join(
    'flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-stone-200 bg-white/70 p-4 shadow-xl dark:border-border dark:bg-slate-900/80',
    'lg:p-6'
  )}
>
  <div class="flex items-start justify-between gap-3">
    <div>
      <div class="text-lg font-bold">Search</div>
      <div class="text-sm text-stone-600 dark:text-stone-400">
        Press Enter or click Search. (Min 3 chars.)
      </div>
    </div>
  </div>

  <form
    class="space-y-3"
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
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="space-y-1">
        <Label for="project-select" class="text-sm font-semibold">Project</Label>
        <select
          id="project-select"
          name="project_id"
          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          bind:value={project_id}
        >
          {#each PROJECT_LIST as project (project.id)}
            <option value={project.id}>{project.name}</option>
          {/each}
          <option value={0}>All</option>
        </select>
      </div>

      <div class="space-y-1">
        <Label for="path-filter" class="text-sm font-semibold">Path filter</Label>
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

    <div class="space-y-1">
      <Label for="search-text" class="text-sm font-semibold">Search text</Label>
      <Input
        id="search-text"
        name="search_text"
        placeholder="Type something..."
        bind:value={search_text}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            form_el?.requestSubmit();
          }
        }}
      />
    </div>

    <div class="flex items-center justify-between gap-3">
      <div class="text-sm">
        {#if validation_error}
          <span class="text-red-600 dark:text-red-400">{validation_error}</span>
        {:else if started && $search_q.isFetching}
          <span class="text-stone-600 dark:text-stone-400">Searching…</span>
        {:else}
          <span class="text-stone-600 dark:text-stone-400"> </span>
        {/if}
      </div>
      <Button type="submit" disabled={$search_q.isFetching}>
        {$search_q.isFetching ? 'Searching…' : 'Search'}
      </Button>
    </div>
  </form>

  <div class="min-h-0 flex-1 space-y-2">
    <div class="flex items-center justify-between">
      <div class="text-sm font-semibold">Results</div>
      <div class="text-xs text-stone-600 dark:text-stone-400">
        {#if started}
          {$search_q.isFetching
            ? 'Loading'
            : $search_q.isSuccess
              ? `${$search_q.data.items.length} found`
              : ''}
        {:else}
          Not started
        {/if}
      </div>
    </div>

    {#if started && $search_q.isSuccess}
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs text-stone-600 dark:text-stone-400">
          Page {Math.floor(offset / LIMIT) + 1}
          <span class="opacity-60">·</span>
          Showing {offset + 1}-{offset + $search_q.data.items.length}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!$search_q.data.page.hasMore || $search_q.isFetching}
            onclick={() => go_to_offset($search_q.data.page.nextOffset ?? offset + LIMIT)}
          >
            Next
          </Button>
        </div>
      </div>
    {/if}

    <div class="max-h-[65vh] overflow-y-auto pr-1">
      {#if !started}
        <div
          class="rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-600 dark:border-border dark:text-stone-400"
        >
          Enter a query and submit to start searching.
        </div>
      {:else if $search_q.isFetching}
        <div class="space-y-2">
          {#each Array(6) as _, i (i)}
            <div class="rounded-md border border-stone-200 p-3 dark:border-border">
              <div class="h-3 w-28 animate-pulse rounded bg-stone-300/70 dark:bg-muted"></div>
              <div
                class="mt-2 h-3 w-full animate-pulse rounded bg-stone-300/50 dark:bg-muted"
              ></div>
              <div class="mt-2 h-3 w-4/5 animate-pulse rounded bg-stone-300/40 dark:bg-muted"></div>
            </div>
          {/each}
        </div>
      {:else if $search_q.isError}
        <div
          class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
        >
          <div class="font-semibold">Search failed</div>
          <div class="mt-1 text-xs opacity-80">{String($search_q.error)}</div>
        </div>
      {:else if $search_q.isSuccess}
        {#if $search_q.data.items.length === 0}
          <div class="rounded-md border border-stone-200 p-3 text-sm dark:border-border">
            No results.
          </div>
        {:else}
          <div class="space-y-2">
            {#each $search_q.data.items as row (row.project_id + ':' + row.path + ':' + row.index)}
              <div class="rounded-md border border-stone-200 p-3 dark:border-border">
                <div class="text-xs text-stone-600 dark:text-stone-400">
                  project {row.project_id} · path {row.path} · index {row.index}{#if row.shloka_num}
                    · shloka {row.shloka_num}
                  {/if}
                </div>
                <div class="mt-1 text-sm whitespace-pre-wrap">{row.text}</div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="rounded-md border border-stone-200 p-3 text-sm dark:border-border">
          Submit a search to see results.
        </div>
      {/if}
    </div>
  </div>
</div>
