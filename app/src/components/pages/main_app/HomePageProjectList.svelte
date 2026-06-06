<script lang="ts">
  import { client_q } from '~/api/client';
  import { Skeleton } from '~/lib/components/ui/skeleton';
  import { Button } from '~/lib/components/ui/button';
  import * as InputGroup from '$lib/components/ui/input-group';
  import * as Select from '$lib/components/ui/select';
  import SearchIcon from '@lucide/svelte/icons/search';
  import Plus from '@lucide/svelte/icons/plus';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import ListX from '@lucide/svelte/icons/list-x';
  import { user_info } from '~/state/user.svelte';
  import ProjectAddNewDialog from './settings/ProjectAddNewDialog.svelte';

  const DEFAULT_PAGE_SIZE = 15;
  const is_admin = $derived($user_info?.role === 'admin');
  let add_project_open = $state(false);

  let page = $state(1);
  let size = $state(DEFAULT_PAGE_SIZE);
  let search_input = $state('');
  let submitted_search = $state('');
  let listed_filter = $state<'all' | 'listed' | 'unlisted'>('all');

  const listed_param = $derived(
    is_admin ? (listed_filter === 'all' ? undefined : listed_filter === 'listed') : true
  );

  let project_list_q = $derived(
    client_q.project.get_project_list.query({
      page,
      size,
      search: submitted_search || undefined,
      ...(is_admin ? { listed: listed_param } : {})
    })
  );

  const apply_search = () => {
    submitted_search = search_input.trim();
    page = 1;
  };
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
    <InputGroup.Root class="h-9 min-w-0 flex-1 sm:max-w-md">
      <InputGroup.Addon align="inline-start" class="pl-2">
        <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
      </InputGroup.Addon>
      <InputGroup.Input
        placeholder="Search name, Sanskrit name, description…"
        bind:value={search_input}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply_search();
          }
        }}
        aria-label="Search projects"
      />
    </InputGroup.Root>
    <Button type="button" variant="secondary" class="shrink-0" onclick={apply_search}>Search</Button
    >

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

  {#if $project_list_q.isPending}
    <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {#each Array(8) as _, i (i)}
        <Skeleton class="h-24 w-full rounded-lg" />
      {/each}
    </div>
  {:else if $project_list_q.isError}
    <div
      class="mx-auto max-w-xl rounded-xl border border-destructive/50 bg-destructive/10 px-6 py-6 text-center text-destructive"
      role="alert"
    >
      Failed to load projects. Please refresh the page.
    </div>
  {:else if $project_list_q.data}
    <p class="text-xs text-muted-foreground">
      {$project_list_q.data.total} project{$project_list_q.data.total !== 1 ? 's' : ''} · Page
      {$project_list_q.data.page} of {$project_list_q.data.pageCount}
    </p>

    {#if $project_list_q.data.list.length === 0}
      <p class="py-8 text-center text-sm text-muted-foreground">No projects match your filters.</p>
    {:else}
      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {#each $project_list_q.data.list as project (project.id)}
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

    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!$project_list_q.data.hasPrev}
        onclick={() => (page = $project_list_q.data!.page - 1)}
      >
        Previous
      </Button>
      <span class="text-xs text-muted-foreground">
        Page {$project_list_q.data.page} / {$project_list_q.data.pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!$project_list_q.data.hasNext}
        onclick={() => (page = $project_list_q.data!.page + 1)}
      >
        Next
      </Button>
    </div>
  {/if}
</div>
