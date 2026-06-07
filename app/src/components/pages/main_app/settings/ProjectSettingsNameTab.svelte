<script lang="ts">
  import { createMutation } from '@tanstack/svelte-query';
  import { useTRPC } from '~/api/client';
  import { invalidate_project_registry_queries } from '~/state/main_app/data.svelte';
  import type { project_type } from '~/state/project_list';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import { toast } from 'svelte-sonner';

  let { project }: { project: project_type } = $props();
  const trpc = useTRPC();

  let name = $state('');
  let name_dev = $state('');
  let description = $state('');

  const name_dev_input_id = 'project-settings-name-dev';
  const name_dev_typing_switch_id = 'project-settings-name-dev-typing';
  let typing_ctx = $derived(createTypingContext('Devanagari'));
  let typing_enabled = $state(true);

  $effect(() => {
    typing_ctx.ready;
  });

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }

  $effect(() => {
    name = project.name;
    name_dev = project.name_dev;
    description = project.description ?? '';
  });

  const save_mut = createMutation(() =>
    trpc.project.edit.update_name_description.mutationOptions({
      onSuccess: async () => {
        await invalidate_project_registry_queries(project.id);
        toast.success('Project details saved');
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to save project details');
      }
    })
  );

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
    save_mut.mutate({
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
    <div class="flex flex-wrap items-center justify-between gap-2">
      <Label for={name_dev_input_id}>Name (देवनागरी)</Label>
      <div class="flex items-center gap-2">
        <Label
          for={name_dev_typing_switch_id}
          class="cursor-pointer text-xs font-medium text-muted-foreground select-none"
        >
          Typing
        </Label>
        <Switch
          id={name_dev_typing_switch_id}
          bind:checked={typing_enabled}
          title="Devanagari transliteration typing (Alt+X / Alt+C)"
        />
      </div>
    </div>
    <Input
      id={name_dev_input_id}
      bind:value={name_dev}
      placeholder="Name in देवनागरी, e.g. श्रीमद्भगवद्गीता"
      autocomplete="off"
      class="font-sans"
      onbeforeinput={(e) =>
        handleTypingBeforeInputEvent(typing_ctx, e, (v) => (name_dev = v), typing_enabled)}
      onblur={() => typing_ctx.clearContext()}
      onkeydown={(e) => {
        if (toggle_typing_from_keyboard(e)) return;
        clearTypingContextOnKeyDown(e, typing_ctx);
      }}
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
    <Button type="button" disabled={save_mut.isPending} onclick={save}>
      {save_mut.isPending ? 'Saving…' : 'Save'}
    </Button>
  </div>
</div>
