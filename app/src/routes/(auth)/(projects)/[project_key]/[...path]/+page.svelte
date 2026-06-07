<script lang="ts">
  import { page } from '$app/state';
  import { get_page_title_info } from '~/state/page_titles';
  import type { PageData } from './$types';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { get_project_from_key, EMPTY_PROJECT_REGISTRY } from '~/state/project_list';
  import { createQuery } from '@tanstack/svelte-query';
  import { project_list_q_options, project_map_q_options } from '~/state/main_app/data.svelte';
  import MainAppPage from '~/components/pages/main_app/MainAppPage.svelte';
  import { Skeleton } from '~/lib/components/ui/skeleton';

  type PageDataWithLevels = PageData & {
    levels: number;
    level_names: string[];
    path_params: number[];
  };
  let { data }: { data: PageDataWithLevels } = $props();

  const project_list_q = $derived(createQuery(project_list_q_options()));
  const project_map_q = $derived(createQuery(project_map_q_options($project_state)));

  const project_key = $derived(data.project_key);
  const levels = $derived(data.levels);
  const project_registry = $derived($project_list_q.data ?? EMPTY_PROJECT_REGISTRY);
  const current_project = $derived(get_project_from_key(project_key, project_registry));
  const project_queries_ready = $derived(
    $project_list_q.isSuccess && $project_map_q.isSuccess && !!current_project
  );

  function set_project_state() {
    const project = current_project;
    if (!project) return;
    $project_state = {
      project_key,
      project_id: project.id,
      listed: project.listed,
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
  set_project_state();
  set_selected_text_levels();
  $effect(() => {
    set_project_state();
  });
  $effect(() => {
    set_selected_text_levels();
  });

  let page_title_info = $derived.by(() => {
    return get_page_title_info(page.url.pathname, project_registry.list);
  });
</script>

{#if page_title_info}
  <MetaTags title={page_title_info.title} />
{/if}

{#if $project_list_q.isPending || $project_map_q.isPending}
  <Skeleton class="h-12 w-full" />
  <Skeleton class="h-[60vh] w-full rounded-lg" />
{:else if project_queries_ready}
  <MainAppPage path_params={data.path_params} />
{/if}
