<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import type { project_type } from '~/state/project_list';
  import { cl_join } from '~/tools/cl_join';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineHome } from 'svelte-icons-pack/ai';
  import SearchIcon from '@lucide/svelte/icons/search';

  let {
    projects,
    current_project_key,
    open = false,
    on_home,
    on_select_project
  }: {
    projects: readonly project_type[];
    current_project_key: string;
    open?: boolean;
    on_home: () => void;
    on_select_project: (key: string) => void;
  } = $props();

  let search_query = $state('');

  const filtered_projects = $derived.by(() => {
    const q = search_query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(q) ||
        project.name_dev.toLowerCase().includes(q) ||
        project.key.toLowerCase().includes(q)
    );
  });

  $effect(() => {
    if (!open) search_query = '';
  });
</script>

<div class="flex w-56 flex-col gap-2 sm:w-64">
  <button
    type="button"
    class={cl_join(
      'block w-full gap-0 rounded-md px-1.5 py-1 text-center text-sm font-semibold',
      'border border-border bg-card text-foreground transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-accent-foreground'
    )}
    onclick={on_home}
  >
    <Icon src={AiOutlineHome} class="-mt-1 mr-1 size-5" />
    Home
  </button>

  <div class="relative">
    <SearchIcon
      class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <Input
      type="search"
      bind:value={search_query}
      placeholder="Search projects…"
      class="h-8 pl-8 text-sm"
      autocomplete="off"
      aria-label="Search projects"
    />
  </div>

  <div class="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
    {#each filtered_projects as project (project.id)}
      <button
        type="button"
        class={cl_join(
          'block w-full gap-0 rounded-md px-1.5 py-1 text-center text-sm font-semibold',
          project.key === current_project_key
            ? 'border border-primary bg-primary text-primary-foreground shadow'
            : 'border border-border bg-card text-foreground transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-accent-foreground'
        )}
        onclick={() => on_select_project(project.key)}
      >
        {project.name}
      </button>
    {:else}
      <p class="py-2 text-center text-xs text-muted-foreground">No matching projects</p>
    {/each}
  </div>
</div>
