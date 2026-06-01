<script lang="ts">
  import { client_q } from '~/api/client';
  import { invalidate_project_list_queries } from '~/state/main_app/data.svelte';
  import type { project_type } from '~/state/project_list';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { toast } from 'svelte-sonner';

  let { project }: { project: project_type } = $props();

  let name = $state('');
  let name_dev = $state('');
  let description = $state('');

  $effect(() => {
    name = project.name;
    name_dev = project.name_dev;
    description = project.description ?? '';
  });

  const save_mut = client_q.project.edit.update_name_description.mutation({
    onSuccess: async () => {
      await invalidate_project_list_queries();
      toast.success('Project details saved');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save project details');
    }
  });

  const save = () => {
    const trimmed_name = name.trim();
    const trimmed_name_dev = name_dev.trim();
    if (!trimmed_name) {
      toast.error('Name is required');
      return;
    }
    if (!trimmed_name_dev) {
      toast.error('Name in Devanagari is required');
      return;
    }
    $save_mut.mutate({
      project_id: project.id,
      name: trimmed_name,
      name_dev: trimmed_name_dev,
      description: description.trim() || null
    });
  };
</script>

<div class="flex flex-col gap-4">
  <div class="space-y-2">
    <Label for="project-settings-name">Name</Label>
    <Input
      id="project-settings-name"
      bind:value={name}
      placeholder="e.g. Bhagavad Gita"
      autocomplete="off"
    />
  </div>
  <div class="space-y-2">
    <Label for="project-settings-name-dev">Name (देवनागरी)</Label>
    <Input
      id="project-settings-name-dev"
      bind:value={name_dev}
      placeholder="Name in देवनागरी, e.g. श्रीमद्भगवद्गीता"
      autocomplete="off"
      class="font-sans"
    />
  </div>
  <div class="space-y-2">
    <Label for="project-settings-description">Description</Label>
    <Textarea
      id="project-settings-description"
      bind:value={description}
      placeholder="Short description shown on the project card and listings"
      rows={4}
      class="resize-y"
    />
  </div>
  <div class="flex justify-end">
    <Button type="button" disabled={$save_mut.isPending} onclick={save}>
      {$save_mut.isPending ? 'Saving…' : 'Save'}
    </Button>
  </div>
</div>
