<script lang="ts">
  import { client_q } from '~/api/client';
  import * as InputGroup from '$lib/components/ui/input-group';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import SearchIcon from '@lucide/svelte/icons/search';
  import Pencil from '@lucide/svelte/icons/pencil';

  let { draft }: { draft: boolean } = $props();

  let page = $state(1);
  let submitted_search = $state('');
  let sort_by = $state<'published_at' | 'updated_at'>('published_at');
  let order_by = $state<'asc' | 'desc'>('desc');
  let limit = $state(20);

  let search_input = $state('');

  let list_q = $derived(
    client_q.site.lekha.list_lekhas.query({
      draft,
      page,
      limit,
      search_text: submitted_search,
      sort_by,
      order_by
    })
  );

  const apply_search = () => {
    submitted_search = search_input.trim();
    page = 1;
  };
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
    <InputGroup.Root class="h-9 min-w-0 flex-1 sm:max-w-md">
      <InputGroup.Addon align="inline-start" class="pl-2">
        <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
      </InputGroup.Addon>
      <InputGroup.Input
        placeholder="Search title, description, tags…"
        bind:value={search_input}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply_search();
          }
        }}
        aria-label="Search lekha"
      />
    </InputGroup.Root>
    <Button type="button" variant="secondary" class="shrink-0" onclick={apply_search}>
      Search
    </Button>

    <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
      <span class="text-xs text-muted-foreground">Sort</span>
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
        <Select.Trigger class="h-9 w-40 text-xs" aria-label="Sort by">
          {sort_by === 'published_at' ? 'Published' : 'Updated'}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="published_at">Published</Select.Item>
          <Select.Item value="updated_at">Updated</Select.Item>
        </Select.Content>
      </Select.Root>
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
        <Select.Trigger class="h-9 w-28 text-xs" aria-label="Order">
          {order_by === 'desc' ? 'Newest first' : 'Oldest first'}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="desc">Newest first</Select.Item>
          <Select.Item value="asc">Oldest first</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
  </div>

  {#if $list_q.isFetching}
    <div class="space-y-2">
      {#each Array(4) as _, i (i)}
        <Skeleton class="h-20 w-full rounded-lg" />
      {/each}
    </div>
  {:else if $list_q.isError}
    <p class="text-sm text-destructive">{String($list_q.error)}</p>
  {:else if $list_q.data}
    <p class="text-xs text-muted-foreground">
      {$list_q.data.total} post{$list_q.data.total !== 1 ? 's' : ''} · Page {$list_q.data.page} of
      {$list_q.data.pageCount}
    </p>
    <ul class="flex flex-col gap-2">
      {#each $list_q.data.list as row (row.id)}
        <li
          class="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <h3 class="truncate leading-tight font-medium">{row.title}</h3>
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
              Published {row.published_at ? new Date(row.published_at).toLocaleString() : '—'} · Updated
              {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
            </p>
          </div>
          <Button variant="outline" size="sm" class="shrink-0 gap-1" href="/lekha/edit/{row.id}">
            <Pencil class="size-3.5" aria-hidden="true" />
            Edit
          </Button>
        </li>
      {/each}
    </ul>
    {#if $list_q.data.list.length === 0}
      <p class="py-8 text-center text-sm text-muted-foreground">No posts in this view.</p>
    {/if}
    <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!$list_q.data.hasPrev}
        onclick={() => (page = $list_q.data!.page - 1)}
      >
        Previous
      </Button>
      <span class="text-xs text-muted-foreground">
        Page {$list_q.data.page} / {$list_q.data.pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!$list_q.data.hasNext}
        onclick={() => (page = $list_q.data!.page + 1)}
      >
        Next
      </Button>
    </div>
  {/if}
</div>
