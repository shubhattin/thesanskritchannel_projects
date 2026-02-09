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
  import { get_project_from_key, PROJECT_LIST } from '~/state/project_list';
  import UserControls from '~/components/pages/main_app/user/UserControls.svelte';
  import MainAppPage from '~/components/pages/main_app/MainAppPage.svelte';
  import * as Popover from '$lib/components/ui/popover';
  import { cl_join } from '~/tools/cl_join';
  import { goto } from '$app/navigation';
  import { BsChevronDown, BsChevronUp, BsThreeDots } from 'svelte-icons-pack/bs';
  import Icon from '~/tools/Icon.svelte';
  import { fade } from 'svelte/transition';
  import { AiOutlineHome } from 'svelte-icons-pack/ai';

  type PageDataWithLevels = PageData & {
    levels: number;
    level_names: string[];
    path_params: number[];
    path_names: (string | undefined)[];
  };
  let { data }: { data: PageDataWithLevels } = $props();

  const project_key = $derived(data.project_key);
  const levels = $derived(data.levels);
  const project_id = $derived(get_project_from_key(project_key).id);
  function set_project_state() {
    $project_state = {
      project_key,
      project_id,
      levels,
      level_names: data.level_names
    };
  }
  function set_selected_text_levels() {
    const total_levels = Math.max(levels - 1, 2);
    const next = Array.from({ length: total_levels }, () => null) as (number | null)[];
    const path_params = data.path_params ?? [];
    // `path_params` are higher -> lower (URL order). `selected_text_levels` are lower -> higher (index 0 is leaf).
    // So path_params[0] should populate the highest slot (levels-2), not the leaf slot (0).
    for (let i = 0; i < path_params.length && i < next.length; i++) {
      const highest_state_index = levels - 2; // highest selector is always `levels-2`, even if we pad `next`
      const target_index = highest_state_index - i;
      if (target_index < 0 || target_index >= next.length) break;
      next[target_index] = path_params[i] ?? null;
    }
    $selected_text_levels = next;
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
    <div class="flex items-center justify-start space-x-6">
      <Popover.Root bind:open={project_selected_popover}>
        <Popover.Trigger class="outline-none">
          <div class="flex space-x-2 opacity-60">
            {#if !project_selected_popover}
              <Icon src={BsChevronDown} class="mb-1 text-lg" />
            {:else}
              <Icon src={BsChevronUp} class="mb-1 text-lg" />
            {/if}
            <span>{get_project_from_key(project_key).name}</span>
          </div>
        </Popover.Trigger>
        <Popover.Content side="bottom" class="w-auto space-y-2 p-2">
          <div class="space-y-2">
            <button
              class={cl_join(
                'block w-full gap-0 rounded-md px-1.5 py-1 text-center text-sm font-semibold',
                'border border-border bg-card text-foreground transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-accent-foreground'
              )}
              onclick={() => {
                project_selected_popover = false;
                goto(`/`);
              }}
            >
              <Icon src={AiOutlineHome} class="-mt-1 mr-1 size-5" />
              Home
            </button>
            {#each PROJECT_LIST as project, i}
              <button
                class={cl_join(
                  'block w-full gap-0 rounded-md px-1.5 py-1 text-center text-sm font-semibold',
                  project.key === project_key
                    ? 'border border-primary bg-primary text-primary-foreground shadow'
                    : 'border border-border bg-card text-foreground transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-accent-foreground'
                )}
                onclick={() => {
                  project_selected_popover = false;
                  goto(`/${project.key}`);
                }}>{project.name}</button
              >
            {/each}
          </div>
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
    </div>

    <!-- Bread Crum Navigator -- Comming Soon -->
    <div>
      <UserControls />
    </div>
  </div>
  <MainAppPage {...data} />
</div>
