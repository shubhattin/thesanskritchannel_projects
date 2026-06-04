<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import type { recursive_list_type } from '~/state/data_types';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import MapNodePathLabels from './MapNodePathLabels.svelte';
  import {
    apply_map_metadata_patch,
    type MapMetadataPatch,
    type MapMetadataSaveMutation
  } from './map_metadata_save';

  export type ListNameEditTarget = {
    path: number[];
    initial_value: string;
    map: recursive_list_type;
  };

  let {
    open = $bindable(false),
    target = $bindable<ListNameEditTarget | null>(null),
    project_id,
    save_mut
  }: {
    open?: boolean;
    target?: ListNameEditTarget | null;
    project_id: number;
    save_mut: MapMetadataSaveMutation;
  } = $props();

  let draft = $state('');
  let original = $state('');
  let confirmed = $state<'yes' | 'no'>('no');

  const has_change = $derived(draft.trim() !== original.trim());
  const can_save = $derived(has_change && confirmed === 'yes' && !$save_mut.isPending);

  $effect(() => {
    if (open && target) {
      original = target.initial_value;
      draft = target.initial_value;
      confirmed = 'no';
    }
  });

  function close() {
    open = false;
    target = null;
  }

  async function submit() {
    if (!target || !can_save) return;
    const patch: MapMetadataPatch = {
      kind: 'list_name',
      path: target.path,
      value: draft.trim()
    };
    try {
      await $save_mut.mutateAsync({
        project_id,
        map: apply_map_metadata_patch(target.map, patch),
        to_add_paths: []
      });
      close();
    } catch {
      // toast handled by mutation
    }
  }
</script>

<Dialog.Root bind:open onOpenChange={(v) => !v && close()}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Edit level label</Dialog.Title>
      <Dialog.Description>
        Change the list type name shown in selectors (e.g. Kanda, Sarga, Chapter).
      </Dialog.Description>
    </Dialog.Header>

    {#if target}
      <MapNodePathLabels map={target.map} path={target.path} />

      <div
        class="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
        role="alert"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0" />
        <p>
          Editing the level label can affect existing links and bookmarks that reference this
          project structure. Proceed only if you understand the impact.
        </p>
      </div>

      <div class="space-y-2">
        <Label for="edit-list-name-input">Level label</Label>
        <Input
          id="edit-list-name-input"
          bind:value={draft}
          autocomplete="off"
          disabled={$save_mut.isPending}
        />
      </div>

      <fieldset class="space-y-1.5">
        <legend class="text-sm font-medium">Are you sure you want to save changes?</legend>
        <RadioGroup.Root bind:value={confirmed} class="flex flex-wrap gap-x-4 gap-y-1">
          <div class="flex items-center gap-1.5">
            <RadioGroup.Item value="no" id="edit-list-name-confirm-no" />
            <Label for="edit-list-name-confirm-no" class="cursor-pointer text-sm font-normal"
              >No</Label
            >
          </div>
          <div class="flex items-center gap-1.5">
            <RadioGroup.Item value="yes" id="edit-list-name-confirm-yes" />
            <Label for="edit-list-name-confirm-yes" class="cursor-pointer text-sm font-normal"
              >Yes</Label
            >
          </div>
        </RadioGroup.Root>
      </fieldset>
    {/if}

    <Dialog.Footer class="gap-2 sm:gap-0">
      <Button type="button" variant="outline" onclick={close} disabled={$save_mut.isPending}>
        Cancel
      </Button>
      <Button type="button" disabled={!can_save} onclick={submit}>
        {#if $save_mut.isPending}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        Save
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
