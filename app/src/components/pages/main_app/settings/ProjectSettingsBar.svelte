<script lang="ts">
  import { project_state } from '~/state/main_app/state.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { project_list_q_options } from '~/state/main_app/data.svelte';
  import { useSession } from '~/lib/auth-client';
  import { EMPTY_PROJECT_REGISTRY, get_project_from_id } from '~/state/project_list';
  import { Button } from '$lib/components/ui/button';
  import Settings from '@lucide/svelte/icons/settings';
  import { cl_join } from '~/tools/cl_join';
  import ProjectSettingsDialog from './ProjectSettingsDialog.svelte';

  const session = useSession();

  const project_list_q = createQuery(() => project_list_q_options());

  const is_admin = $derived($session.data?.user.role === 'admin');

  const project = $derived.by(() => {
    const projectId = $project_state?.project_id;
    if (projectId == null) return undefined;
    return get_project_from_id(projectId, project_list_q.data ?? EMPTY_PROJECT_REGISTRY);
  });

  let settings_open = $state(false);
</script>

<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
  <span
    class={cl_join([
      'rounded-full border px-2 py-0.5 font-medium',
      $project_state?.listed
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    ])}
  >
    {$project_state?.listed ? 'Listed' : 'Unlisted'}
  </span>

  {#if is_admin && project}
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="ml-auto h-9 gap-1.5 px-2.5 text-xs sm:ml-0 sm:text-sm"
      onclick={() => (settings_open = true)}
    >
      <Settings class="size-4" aria-hidden="true" />
      Settings
    </Button>
    <ProjectSettingsDialog bind:open={settings_open} {project} />
  {/if}
</div>
