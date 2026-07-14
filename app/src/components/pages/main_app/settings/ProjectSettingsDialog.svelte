<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import type { project_type } from '~/state/project_list';
  import { project_state } from '~/state/main_app/state.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Tabs from '$lib/components/ui/tabs';
  import ProjectSettingsNameTab from './ProjectSettingsNameTab.svelte';
  import ProjectSettingsListedSlugTab from './ProjectSettingsListedSlugTab.svelte';
  import ProjectSettingsDeleteTab from './ProjectSettingsDeleteTab.svelte';

  let {
    open = $bindable(false),
    project
  }: {
    open?: boolean;
    project: project_type;
  } = $props();

  let active_tab = $state('name');
  const query_client = useQueryClient();

  // Controlled `open=true` from the Settings button may not go through onOpenChange.
  $effect.pre(() => {
    if (!open) return;
    active_tab = 'name';
    void query_client.invalidateQueries({ queryKey: ['project_list'] });
  });

  const on_slug_changed = (newKey: string) => {
    open = false;
    goto(`/${newKey}`);
  };

  const on_project_saved = () => {
    open = false;
  };

  const on_project_deleted = async () => {
    open = false;
    $project_state = null;
    toast.success(`Deleted “${project.name}”`, {
      description: 'Redirecting to the home page.'
    });
    await goto(resolve('/'), { invalidateAll: true });
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[90vh] max-w-lg overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Project settings</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        <span class="block">{project.name}</span>
        <span class="mt-0.5 block text-xs tabular-nums">Internal ID: {project.id}</span>
      </Dialog.Description>
    </Dialog.Header>

    {#if open}
      <Tabs.Root bind:value={active_tab} class="mt-2">
        <Tabs.List class="grid w-full grid-cols-3">
          <Tabs.Trigger value="name">Name</Tabs.Trigger>
          <Tabs.Trigger value="listed-slug">Listed &amp; slug</Tabs.Trigger>
          <Tabs.Trigger value="delete">Delete</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="name" class="mt-4">
          <ProjectSettingsNameTab {project} onSaved={on_project_saved} />
        </Tabs.Content>
        <Tabs.Content value="listed-slug" class="mt-4">
          <ProjectSettingsListedSlugTab {project} onSlugChanged={on_slug_changed} />
        </Tabs.Content>
        <Tabs.Content value="delete" class="mt-4">
          {#if active_tab === 'delete'}
            <ProjectSettingsDeleteTab {project} onDeleted={on_project_deleted} />
          {/if}
        </Tabs.Content>
      </Tabs.Root>
    {/if}
  </Dialog.Content>
</Dialog.Root>
