<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';
  import { BsChevronDown, BsChevronUp, BsThreeDots } from 'svelte-icons-pack/bs';
  import Icon from '~/tools/Icon.svelte';
  import { fade } from 'svelte/transition';
  import { Skeleton } from '~/lib/components/ui/skeleton';
  import UserControls from '~/components/pages/main_app/user/UserControls.svelte';
  import MainSitePageLink from '~/components/pages/main_app/MainSitePageLink.svelte';
  import ProjectSwitcherMenu from '~/components/pages/main_app/ProjectSwitcherMenu.svelte';
  import { APP_SCOPE_ID_PROJECT_PORTAL } from '~/state/data_types';
  import { editing_mode, text_data_present } from '~/state/main_app/state.svelte';
  import { map_edit_dirty } from '~/state/map_edit_dirty.svelte';
  import { get_project_from_key, EMPTY_PROJECT_REGISTRY } from '~/state/project_list';
  import { createQuery } from '@tanstack/svelte-query';
  import {
    compute_text_data_present,
    project_list_q_options,
    project_map_q_options
  } from '~/state/main_app/data.svelte';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { useSession } from '~/lib/auth-client';

  let { children }: { children: Snippet } = $props();

  const session = useSession();

  const project_list_q = createQuery(() => project_list_q_options());
  const project_map_q = createQuery(() => project_map_q_options($project_state));

  $effect(() => {
    $text_data_present = compute_text_data_present(
      $project_state,
      $selected_text_levels,
      project_map_q.data,
      project_map_q.isSuccess
    );
  });

  const project_key = $derived(page.params.project_key ?? '');
  const project_registry = $derived(project_list_q.data ?? EMPTY_PROJECT_REGISTRY);
  const current_project = $derived(get_project_from_key(project_key, project_registry));
  const project_queries_ready = $derived(
    project_list_q.isSuccess && project_map_q.isSuccess && !!current_project
  );
  const nav_disabled = $derived($editing_mode !== 'none' || $map_edit_dirty);
  const is_admin = $derived($session.data?.user.role === 'admin');
  const active_tab = $derived(
    page.url.pathname.includes(`/${project_key}/edit`) ? 'edit-map' : 'texts'
  );

  let project_selected_popover = $state(false);

  $effect(() => {
    if (nav_disabled) project_selected_popover = false;
  });

  const tab_trigger_class = (is_active: boolean) =>
    cn(
      'inline-flex h-[calc(100%-1px)] min-w-20 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
      is_active &&
        'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30 dark:text-foreground'
    );

  function go_texts() {
    if (nav_disabled) return;
    goto(`/${project_key}`);
  }

  function go_edit_map() {
    if (nav_disabled) return;
    goto(`/${project_key}/edit`);
  }
</script>

<div class="mt-2 space-y-2.5 sm:mt-4 sm:space-y-4">
  {#if project_list_q.isPending || project_map_q.isPending}
    <div class="flex items-center justify-between">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-8 w-24" />
    </div>
    <Skeleton class="h-9 w-44" />
  {:else if project_list_q.isError || project_map_q.isError || !current_project}
    <div
      class="mx-auto max-w-xl rounded-xl border border-destructive/50 bg-destructive/10 px-6 py-6 text-center text-destructive"
      role="alert"
    >
      Failed to load project data. Please refresh or return to the home page.
    </div>
  {:else if project_queries_ready}
    <div class="mb-0 flex w-full items-start justify-between sm:mb-2.5">
      <div class="flex flex-wrap items-center justify-start gap-x-6 gap-y-2">
        <Popover.Root bind:open={project_selected_popover}>
          <Popover.Trigger
            class={cn('outline-none', nav_disabled && 'pointer-events-none opacity-50')}
            disabled={nav_disabled}
          >
            <div class="flex space-x-2 opacity-60">
              {#if !project_selected_popover}
                <Icon src={BsChevronDown} class="mb-1 text-lg" />
              {:else}
                <Icon src={BsChevronUp} class="mb-1 text-lg" />
              {/if}
              <span>{current_project.name}</span>
            </div>
          </Popover.Trigger>
          <Popover.Content side="bottom" class="w-auto p-2">
            <ProjectSwitcherMenu
              projects={project_registry.list}
              current_project_key={project_key}
              open={project_selected_popover}
              on_home={() => {
                project_selected_popover = false;
                goto(`/`);
              }}
              on_select_project={(key) => {
                project_selected_popover = false;
                goto(`/${key}`);
              }}
            />
          </Popover.Content>
        </Popover.Root>
        {#if $text_data_present}
          <div transition:fade>
            {#await import('~/components/pages/main_app/display/project_utility/ProjectUtility.svelte')}
              <button class="btn outline-hidden select-none" title="Extra Options">
                <Icon class="mx-[0.17rem] text-lg sm:mx-0 sm:text-2xl" src={BsThreeDots} />
              </button>
            {:then ProjectUtility}
              <ProjectUtility.default />
            {/await}
          </div>
        {/if}
        {#if active_tab === 'edit-map'}
          <MainSitePageLink use_selected_levels={false} />
        {/if}
      </div>

      <div>
        <UserControls currentpage={APP_SCOPE_ID_PROJECT_PORTAL} />
      </div>
    </div>

    {#if is_admin}
      <nav
        aria-label="Project admin views"
        class="inline-flex h-9 w-fit max-w-full items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground"
      >
        <button
          type="button"
          class={tab_trigger_class(active_tab === 'texts')}
          disabled={nav_disabled}
          aria-current={active_tab === 'texts' ? 'page' : undefined}
          onclick={go_texts}
        >
          Texts
        </button>
        <button
          type="button"
          class={tab_trigger_class(active_tab === 'edit-map')}
          disabled={nav_disabled}
          aria-current={active_tab === 'edit-map' ? 'page' : undefined}
          onclick={go_edit_map}
        >
          Edit Map
        </button>
      </nav>
    {/if}
  {/if}

  {@render children()}
</div>
