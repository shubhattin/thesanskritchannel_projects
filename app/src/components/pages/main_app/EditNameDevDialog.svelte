<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import type { recursive_list_type } from '~/state/data_types';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import MapNodePathLabels from './MapNodePathLabels.svelte';
  import {
    apply_map_metadata_patch,
    type MapMetadataPatch,
    type MapMetadataSaveMutation
  } from './map_metadata_save';

  export type NameDevEditTarget = {
    path: number[];
    initial_value: string;
    map: recursive_list_type;
  };

  let {
    open = $bindable(false),
    target = $bindable<NameDevEditTarget | null>(null),
    project_id,
    save_mut
  }: {
    open?: boolean;
    target?: NameDevEditTarget | null;
    project_id: number;
    save_mut: MapMetadataSaveMutation;
  } = $props();

  let draft = $state('');
  let original = $state('');
  let confirm_open = $state(false);
  let typing_enabled = $state(true);

  const name_dev_input_id = 'main-app-edit-name-dev';
  const name_dev_typing_switch_id = 'main-app-edit-name-dev-typing';

  let typing_ctx = $derived(createTypingContext('Devanagari'));

  const has_change = $derived(draft.trim() !== original.trim());
  const can_save = $derived(has_change && !$save_mut.isPending);

  $effect(() => {
    typing_ctx.ready;
  });

  $effect(() => {
    if (open && target) {
      original = target.initial_value;
      draft = target.initial_value;
      typing_enabled = true;
      confirm_open = false;
    }
  });

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }

  function close() {
    open = false;
    target = null;
    confirm_open = false;
    typing_ctx.clearContext();
  }

  function request_save() {
    if (!can_save) return;
    confirm_open = true;
  }

  async function confirm_save() {
    if (!target || !can_save) return;
    const patch: MapMetadataPatch = {
      kind: 'name_dev',
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
      <Dialog.Title>Edit name (देवनागरी)</Dialog.Title>
      <Dialog.Description>Update the Devanagari display name for this map node.</Dialog.Description>
    </Dialog.Header>

    {#if target}
      <MapNodePathLabels map={target.map} path={target.path} />

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
              disabled={$save_mut.isPending}
              title="Devanagari transliteration typing (Alt+X / Alt+C)"
            />
          </div>
        </div>
        <Input
          id={name_dev_input_id}
          bind:value={draft}
          placeholder="Name in देवनागरी"
          autocomplete="off"
          class="font-sans"
          disabled={$save_mut.isPending}
          onbeforeinput={(e) =>
            handleTypingBeforeInputEvent(typing_ctx, e, (v) => (draft = v), typing_enabled)}
          onblur={() => typing_ctx.clearContext()}
          onkeydown={(e) => {
            if (toggle_typing_from_keyboard(e)) return;
            clearTypingContextOnKeyDown(e, typing_ctx);
          }}
        />
      </div>
    {/if}

    <Dialog.Footer class="gap-2 sm:gap-0">
      <Button type="button" variant="outline" onclick={close} disabled={$save_mut.isPending}>
        Cancel
      </Button>
      <Button type="button" disabled={!can_save} onclick={request_save}>
        {#if $save_mut.isPending}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        Save
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={confirm_open}>
  <AlertDialog.Content class="max-w-md">
    <AlertDialog.Header>
      <AlertDialog.Title>Save changes?</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to save changes?</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={$save_mut.isPending}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action disabled={$save_mut.isPending} onclick={confirm_save}>
        {#if $save_mut.isPending}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        Confirm
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
