<script lang="ts">
  import { goto } from '$app/navigation';
  import type { project_type } from '~/state/project_list';
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
  let saving = $state(false);

  $effect(() => {
    console.log('[ProjectSettingsDialog] saving state changed:', saving);
  });

  const on_slug_changed = (newKey: string) => {
    open = false;
    goto(`/${newKey}`);
  };

  const on_project_saved = () => {
    open = false;
  };

  const on_project_deleted = () => {
    open = false;
    goto('/');
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

    {#if saving}
      <div
        class="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
      >
        <span
          class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        ></span>
        Saving…
      </div>
    {/if}

    <Tabs.Root bind:value={active_tab} class="mt-2">
      <Tabs.List class="grid w-full grid-cols-3">
        <Tabs.Trigger value="name">Name</Tabs.Trigger>
        <Tabs.Trigger value="listed-slug">Listed &amp; slug</Tabs.Trigger>
        <Tabs.Trigger value="delete">Delete</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="name" class="mt-4">
        <ProjectSettingsNameTab {project} bind:saving onSaved={on_project_saved} />
      </Tabs.Content>
      <Tabs.Content value="listed-slug" class="mt-4">
        <ProjectSettingsListedSlugTab {project} bind:saving onSlugChanged={on_slug_changed} />
      </Tabs.Content>
      <Tabs.Content value="delete" class="mt-4">
        <ProjectSettingsDeleteTab {project} bind:saving onDeleted={on_project_deleted} />
      </Tabs.Content>
    </Tabs.Root>
  </Dialog.Content>
</Dialog.Root>
