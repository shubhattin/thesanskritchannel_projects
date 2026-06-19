<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { project_list_q_options } from '~/state/main_app/data.svelte';
  import { EMPTY_PROJECT_REGISTRY, type project_type } from '~/state/project_list';
  import { Skeleton } from '~/lib/components/ui/skeleton';
  import { Button } from '~/lib/components/ui/button';
  import * as InputGroup from '$lib/components/ui/input-group';
  import * as Pagination from '$lib/components/ui/pagination';
  import * as Select from '$lib/components/ui/select';
  import SearchIcon from '@lucide/svelte/icons/search';
  import Plus from '@lucide/svelte/icons/plus';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import ListX from '@lucide/svelte/icons/list-x';
  import ProjectAddNewDialog from './settings/ProjectAddNewDialog.svelte';
  import { useSession } from '~/lib/auth-client';
  import { filter_projects_by_search } from '~/utils/search/project_list_search';
  import { create_project_name_dev_normal_cache } from '~/utils/search/project_name_dev_normal_cache';

  const session = useSession();

  const PAGE_SIZE = 16;
  const is_admin = $derived($session.data?.user.role === 'admin');
  let add_project_open = $state(false);

  let page = $state(1);
  let search_text = $state('');
  let listed_filter = $state<'all' | 'listed' | 'unlisted'>('all');

  const project_list_q = createQuery(() => project_list_q_options());
  const all_projects = $derived(project_list_q.data?.list ?? EMPTY_PROJECT_REGISTRY.list);

  const name_dev_normal_cache = create_project_name_dev_normal_cache();
  let name_dev_cache_version = $state(0);

  $effect(() => {
    const name_devs = all_projects.map((project) => project.name_dev);
    void name_dev_normal_cache.ensure_all(name_devs).then(() => {
      name_dev_cache_version++;
    });
  });

  const matches_listed_filter = (project: project_type) => {
    if (!is_admin || listed_filter === 'all') return true;
    if (listed_filter === 'listed') return project.listed;
    return !project.listed;
  };

  const filtered_projects = $derived.by(() => {
    void name_dev_cache_version;
    const listed_projects = all_projects.filter(matches_listed_filter);
    return filter_projects_by_search(listed_projects, search_text, (name_dev) =>
      name_dev_normal_cache.get(name_dev)
    );
  });
  const total_count = $derived(filtered_projects.length);
  const total_pages = $derived(Math.max(1, Math.ceil(total_count / PAGE_SIZE)));
  const current_page = $derived(Math.max(1, Math.min(page, total_pages)));

  const paginated_projects = $derived(
    filtered_projects.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE)
  );

  const showing_start = $derived(total_count === 0 ? 0 : (current_page - 1) * PAGE_SIZE + 1);
  const showing_end = $derived(Math.min(current_page * PAGE_SIZE, total_count));

  function reset_page() {
    page = 1;
  }
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
    <InputGroup.Root class="h-9 min-w-0 flex-1 sm:max-w-md">
      <InputGroup.Addon align="inline-start" class="pl-2">
        <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
      </InputGroup.Addon>
      <InputGroup.Input
        placeholder="Search name, Sanskrit name, description…"
        bind:value={search_text}
        oninput={reset_page}
        aria-label="Search projects"
      />
    </InputGroup.Root>

    <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
      {#if is_admin}
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-9 gap-1.5 px-2.5 text-xs"
          onclick={() => (add_project_open = true)}
        >
          <Plus class="size-4" aria-hidden="true" />
          Add new project
        </Button>
        <span class="text-xs text-muted-foreground">Listed</span>
        <Select.Root
          type="single"
          value={listed_filter}
          onValueChange={(v) => {
            if (v === 'all' || v === 'listed' || v === 'unlisted') {
              listed_filter = v;
              page = 1;
            }
          }}
        >
          <Select.Trigger class="h-9 w-36 text-xs" aria-label="Filter by listed status">
            {listed_filter === 'all' ? 'All' : listed_filter === 'listed' ? 'Listed' : 'Unlisted'}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All</Select.Item>
            <Select.Item value="listed">Listed</Select.Item>
            <Select.Item value="unlisted">Unlisted</Select.Item>
          </Select.Content>
        </Select.Root>
      {/if}
    </div>
  </div>

  {#if is_admin}
    <ProjectAddNewDialog bind:open={add_project_open} />
  {/if}

  {#if project_list_q.isPending}
    <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {#each Array(8) as _, i (i)}
        <Skeleton class="h-24 w-full rounded-lg" />
      {/each}
    </div>
  {:else if project_list_q.isError}
    <div
      class="mx-auto max-w-xl rounded-xl border border-destructive/50 bg-destructive/10 px-6 py-6 text-center text-destructive"
      role="alert"
    >
      Failed to load projects. Please refresh the page.
    </div>
  {:else}
    {#if total_count > 0}
      <p class="text-xs text-muted-foreground">
        Showing {showing_start}–{showing_end} of {total_count} project{total_count === 1 ? '' : 's'}
        {#if total_pages > 1}
          · Page {current_page} of {total_pages}
        {/if}
      </p>
    {/if}

    {#if paginated_projects.length === 0}
      <p class="py-8 text-center text-sm text-muted-foreground">No projects match your filters.</p>
    {:else}
      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {#each paginated_projects as project (project.id)}
          <a
            href={'/' + project.key}
            class="group block rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-colors duration-150 hover:border-secondary/80 hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
          >
            <div class="flex items-start justify-between gap-2">
              <h2
                class="min-w-0 flex-1 text-base leading-snug font-semibold tracking-tight group-hover:text-primary"
              >
                {project.name}
              </h2>
              {#if is_admin}
                <span
                  class="inline-flex shrink-0 rounded-md p-0.5 {project.listed
                    ? 'text-primary'
                    : 'text-muted-foreground opacity-80'}"
                  title={project.listed
                    ? 'Listed on the public site'
                    : 'Not listed (hidden from public list)'}
                  role="img"
                  aria-label={project.listed
                    ? 'Listed on the public site'
                    : 'Not listed on the public site'}
                >
                  {#if project.listed}
                    <ListChecks class="size-4" aria-hidden="true" />
                  {:else}
                    <ListX class="size-4" aria-hidden="true" />
                  {/if}
                </span>
              {/if}
            </div>
            <p class="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{project.name_dev}</p>
            {#if project.description}
              <p class="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
                {project.description}
              </p>
            {/if}
          </a>
        {/each}
      </div>
    {/if}

    {#if total_pages > 1}
      <Pagination.Root
        count={total_count}
        perPage={PAGE_SIZE}
        bind:page
        class="border-t border-border/60 pt-3"
      >
        {#snippet children({ pages, currentPage })}
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous />
            </Pagination.Item>
            {#each pages as pageItem (pageItem.key)}
              {#if pageItem.type === 'ellipsis'}
                <Pagination.Item>
                  <Pagination.Ellipsis />
                </Pagination.Item>
              {:else}
                <Pagination.Item>
                  <Pagination.Link page={pageItem} isActive={currentPage === pageItem.value}>
                    {pageItem.value}
                  </Pagination.Link>
                </Pagination.Item>
              {/if}
            {/each}
            <Pagination.Item>
              <Pagination.Next />
            </Pagination.Item>
          </Pagination.Content>
        {/snippet}
      </Pagination.Root>
    {/if}
  {/if}
</div>
