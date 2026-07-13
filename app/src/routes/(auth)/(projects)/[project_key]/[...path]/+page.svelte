<script lang="ts">
  import { page } from '$app/state';
  import { untrack } from 'svelte';
  import { get_page_title_info } from '~/state/page_titles';
  import type { PageData } from './$types';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import {
    get_level_names_from_map,
    get_levels_from_map,
    get_project_from_key,
    EMPTY_PROJECT_REGISTRY
  } from '~/state/project_list';
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

  const project_list_q = createQuery(() => project_list_q_options());
  // Track only project_id so levels/level_names writes do not re-enter the query factory.
  const map_query_project_id = $derived($project_state?.project_id ?? null);
  const project_map_q = createQuery(() => {
    const project_id = map_query_project_id;
    if (project_id == null) return project_map_q_options(null);
    return project_map_q_options(untrack(() => $project_state));
  });

  const project_key = $derived(data.project_key);
  // Prefer live map so root list/shloka conversion updates selectors without a full reload.
  const levels = $derived(
    project_map_q.isSuccess ? get_levels_from_map(project_map_q.data) : data.levels
  );
  const level_names = $derived(
    project_map_q.isSuccess
      ? get_level_names_from_map(project_map_q.data).slice(0, levels)
      : data.level_names
  );
  const project_registry = $derived(project_list_q.data ?? EMPTY_PROJECT_REGISTRY);
  const current_project = $derived(get_project_from_key(project_key, project_registry));
  const project_queries_ready = $derived(
    project_list_q.isSuccess && project_map_q.isSuccess && !!current_project
  );

  function set_project_state() {
    const project = current_project;
    if (!project) return;
    const next = {
      project_key,
      project_id: project.id,
      listed: project.listed,
      levels,
      level_names
    };
    const prev = untrack(() => $project_state);
    if (
      prev?.project_key === next.project_key &&
      prev?.project_id === next.project_id &&
      prev?.listed === next.listed &&
      prev?.levels === next.levels &&
      prev.level_names.length === next.level_names.length &&
      prev.level_names.every((name, i) => name === next.level_names[i])
    ) {
      return;
    }
    $project_state = next;
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
    const prev = untrack(() => $selected_text_levels);
    if (prev.length === next.length && prev.every((value, i) => value === next[i])) return;
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

{#if project_list_q.isPending || project_map_q.isPending}
  <Skeleton class="h-12 w-full" />
  <Skeleton class="h-[60vh] w-full rounded-lg" />
{:else if project_queries_ready}
  <MainAppPage path_params={data.path_params} />
{/if}
