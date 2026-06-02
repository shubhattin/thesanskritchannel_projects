<script lang="ts">
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ProjectMapEditor from '~/components/pages/map_edit/ProjectMapEditor.svelte';
  import { untrack } from 'svelte';
  import { get_project_from_key, EMPTY_PROJECT_REGISTRY } from '~/state/project_list';
  import { project_list_q, project_map_q } from '~/state/main_app/data.svelte';
  import { project_state } from '~/state/main_app/state.svelte';
  import { get } from 'svelte/store';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const project_key = $derived(data.project_key);
  const project_registry = $derived($project_list_q.data ?? EMPTY_PROJECT_REGISTRY);
  const current_project = $derived(get_project_from_key(project_key, project_registry));
  const project_queries_ready = $derived(
    $project_list_q.isSuccess && $project_map_q.isSuccess && !!current_project
  );

  function sync_project_state() {
    const project = current_project;
    if (!project) return;

    const prev = untrack(() => get(project_state));

    if (
      prev.project_key === project_key &&
      prev.project_id === project.id &&
      prev.listed === project.listed
    ) {
      return;
    }

    project_state.set({
      project_key,
      project_id: project.id,
      listed: project.listed,
      levels: prev.levels,
      level_names: prev.level_names
    });
  }

  $effect(() => {
    project_key;
    current_project;
    sync_project_state();
  });
</script>

<MetaTags title={`${data.project_name_dev} | Edit Map`} />

{#if $project_list_q.isPending || $project_map_q.isPending}
  <Skeleton class="h-12 w-full" />
  <Skeleton class="h-[60vh] w-full rounded-lg" />
{:else if project_queries_ready && current_project}
  <ProjectMapEditor project_id={current_project.id} project_name_dev={current_project.name_dev} />
{/if}
