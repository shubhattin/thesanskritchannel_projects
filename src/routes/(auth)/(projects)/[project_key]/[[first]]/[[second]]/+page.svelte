<script lang="ts">
  import { page } from '$app/state';
  import { PAGE_TITLES } from '~/state/page_titles';
  import type { PageData } from './$types';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import {
    list_count,
    project_state,
    selected_text_levels,
    text_data_present
  } from '~/state/main_app/state.svelte';
  import {
    get_project_info_from_key,
    get_project_from_key,
    PROJECT_LIST
  } from '~/state/project_list';
  import UserControls from '~/components/pages/main_app/user/UserControls.svelte';
  import MainAppPage from '~/components/pages/main_app/MainAppPage.svelte';
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { cl_join } from '~/tools/cl_join';
  import { goto } from '$app/navigation';
  import { BsChevronDown, BsChevronUp, BsThreeDots } from 'svelte-icons-pack/bs';
  import Icon from '~/tools/Icon.svelte';
  import { fade } from 'svelte/transition';

  let { data }: { data: PageData } = $props();

  const project_key = $derived(data.project_key);
  const levels = $derived(get_project_info_from_key(project_key).levels);
  const project_id = $derived(get_project_from_key(project_key).id);
  function set_project_state() {
    $project_state = {
      project_key,
      project_id,
      levels
    };
  }
  function set_selected_text_levels() {
    if (levels === 2) {
      $selected_text_levels = [data.first ?? null, null];
    } else if (levels === 3) {
      $selected_text_levels = [data.second ?? null, data.first ?? null];
    } else {
      $selected_text_levels = [null, null];
    }
  }
  function set_list_count() {
    $list_count = data.list_count!;
  }
  set_project_state();
  set_selected_text_levels();
  set_list_count();
  $effect(() => {
    set_project_state();
  });
  $effect(() => {
    set_selected_text_levels();
  });
  $effect(() => {
    set_list_count();
  });

  let page_title_info = $derived.by(() => {
    const pathname = page.url.pathname;
    for (let key in PAGE_TITLES) {
      const { startsWith } = PAGE_TITLES[key];
      if (key === pathname && !startsWith) {
        return PAGE_TITLES[key];
      } else if (pathname.startsWith(key) && startsWith) {
        return PAGE_TITLES[key];
      }
    }
  });

  let project_selected_popover = $state(false);
</script>

{#if page_title_info}
  <MetaTags title={page_title_info.title} />
{/if}

<div class="mt-2 space-y-2.5 sm:mt-4 sm:space-y-4">
  <div class="mb-0 flex w-full items-start justify-between sm:mb-2.5">
    <div class="flex space-x-6">
      <ol class="flex cursor-default items-center gap-2 select-none sm:gap-3">
        <li>
          <Popover
            open={project_selected_popover}
            onOpenChange={(e) => (project_selected_popover = e.open)}
            contentBase="card z-50 space-y-2 p-2 rounded-lg shadow-xl dark:bg-surface-900 bg-slate-100"
          >
            {#snippet trigger()}
              <div class="flex space-x-2 opacity-60 outline-hidden">
                {#if !project_selected_popover}
                  <Icon src={BsChevronDown} class="mb-1 text-lg" />
                {:else}
                  <Icon src={BsChevronUp} class="mb-1 text-lg" />
                {/if}
                <span>{get_project_from_key(project_key).name}</span>
              </div>
            {/snippet}
            {#snippet content()}
              <div class="space-y-2">
                {#each PROJECT_LIST as project, i}
                  <button
                    class={cl_join(
                      'block w-full gap-0 rounded-md px-1.5 py-1 text-center text-sm font-semibold text-white',
                      project.key === project_key
                        ? 'bg-primary-500 dark:bg-primary-600'
                        : 'bg-slate-400 hover:bg-primary-500/80 dark:bg-slate-800 dark:hover:bg-primary-600/80'
                    )}
                    onclick={() => {
                      project_selected_popover = false;
                      goto(`/${project.key}`);
                    }}>{project.name}</button
                  >
                {/each}
              </div>
            {/snippet}
          </Popover>
        </li>
      </ol>
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
    </div>

    <!-- Bread Crum Navigator -- Comming Soon -->
    <div>
      <UserControls />
    </div>
  </div>
  <MainAppPage {...data} />
</div>
