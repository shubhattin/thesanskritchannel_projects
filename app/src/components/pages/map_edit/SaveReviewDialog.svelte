<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import type { PathSwapEdit } from '~/server/map_path_swap';
  import type { DeleteReviewRow, MapEditDiffState, MapNodeWithClientId } from './map_edit_lib';
  import ChangesPanel from './ChangesPanel.svelte';
  import DeleteImpactTable from './DeleteImpactTable.svelte';

  let {
    open = $bindable(false),
    mode,
    order_dirty,
    metadata_dirty,
    delete_dirty = false,
    active_diff_state,
    pending_swaps,
    diffState,
    workingMap,
    project_id = 0,
    delete_review_rows = [],
    terminal_deleted_count = 0,
    saving = false,
    onConfirm
  }: {
    open?: boolean;
    mode: 'metadata' | 'order' | 'delete';
    order_dirty: boolean;
    metadata_dirty: boolean;
    delete_dirty?: boolean;
    active_diff_state: MapEditDiffState;
    pending_swaps: PathSwapEdit[];
    diffState: MapEditDiffState;
    workingMap: MapNodeWithClientId | null;
    project_id?: number;
    delete_review_rows?: DeleteReviewRow[];
    terminal_deleted_count?: number;
    saving?: boolean;
    onConfirm: () => void | Promise<void>;
  } = $props();

  const order_edit_mode = $derived(mode === 'order');

  let reviewed = $state<'yes' | 'no'>('no');
  let localSaving = $state(false);

  const inFlight = $derived(saving || localSaving);
  const can_save = $derived(reviewed === 'yes' && !inFlight);

  $effect(() => {
    if (open) {
      reviewed = 'no';
      localSaving = false;
    }
  });

  $effect(() => {
    if (!saving && localSaving) {
      localSaving = false;
    }
  });

  const title = $derived(
    mode === 'delete'
      ? 'Delete map nodes permanently'
      : mode === 'order'
        ? 'Save list order'
        : 'Save map changes'
  );

  const save_label = $derived(
    inFlight
      ? 'Saving…'
      : mode === 'delete'
        ? 'Delete permanently'
        : mode === 'order'
          ? 'Save current order'
          : 'Save'
  );

  async function handleConfirm() {
    if (localSaving || saving) return;
    localSaving = true;
    try {
      await onConfirm();
    } catch {
      localSaving = false;
    }
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(v) => {
    if (!inFlight) open = v;
  }}
>
  <Dialog.Content
    class="flex max-h-[min(88vh,48rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
    showCloseButton={!inFlight}
  >
    <Dialog.Header class="shrink-0 space-y-0.5 border-b border-border/60 px-4 pt-4 pb-3">
      <Dialog.Title class="text-base">{title}</Dialog.Title>
      <Dialog.Description class="text-base font-semibold">
        {#if mode === 'delete'}
          This permanently removes the selected nodes and all connected content. Review the impact
          below, confirm, then delete.
        {:else}
          Review the changes, confirm below, then save.
        {/if}
      </Dialog.Description>
      {#if mode === 'delete'}
        <p
          class="mt-2 inline-flex w-fit rounded-md border border-destructive/35 bg-destructive/8 px-2 py-1 text-xs font-medium text-destructive dark:text-red-300"
        >
          This action is not reversible.
        </p>
      {/if}
    </Dialog.Header>

    <div class="shrink-0 space-y-2.5 border-b border-border/60 px-4 py-3">
      {#if mode === 'metadata'}
        <ul class="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          <li>
            {diffState.rows.length} update{diffState.rows.length === 1 ? '' : 's'} across {diffState.changedNodeCount}
            node{diffState.changedNodeCount === 1 ? '' : 's'}
          </li>
          <li>{diffState.renameCount} rename{diffState.renameCount === 1 ? '' : 's'}</li>
          <li>
            {diffState.reorderedParentCount} parent list{diffState.reorderedParentCount === 1
              ? ''
              : 's'} reordered
          </li>
        </ul>
      {:else if mode === 'order'}
        <ul class="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          <li>
            {pending_swaps.length} path swap{pending_swaps.length === 1 ? '' : 's'} → texts, translations,
            media
          </li>
          <li>Map structure saved with the new order</li>
        </ul>
      {:else}
        <ul class="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          <li>
            {terminal_deleted_count} terminal path{terminal_deleted_count === 1 ? '' : 's'} will be removed
            from the map
          </li>
          <li>Connected texts, translations, and media at those paths will be deleted</li>
          <li>This cannot be undone from the editor</li>
        </ul>
      {/if}

      <fieldset class="space-y-1.5">
        <legend class="text-xs font-medium">
          {mode === 'delete' ? 'Reviewed deletion impact?' : 'Reviewed all changes?'}
        </legend>
        <RadioGroup.Root
          bind:value={reviewed}
          class="flex flex-wrap gap-x-4 gap-y-1"
          disabled={inFlight}
        >
          <div class="flex items-center gap-1.5">
            <RadioGroup.Item value="no" id="map-save-review-no" />
            <Label for="map-save-review-no" class="cursor-pointer text-xs font-normal">No</Label>
          </div>
          <div class="flex items-center gap-1.5">
            <RadioGroup.Item value="yes" id="map-save-review-yes" />
            <Label for="map-save-review-yes" class="cursor-pointer text-xs font-normal">Yes</Label>
          </div>
        </RadioGroup.Root>
      </fieldset>

      <p class="text-[11px] leading-snug text-muted-foreground">
        {#if mode === 'metadata'}
          Root name also updates the project display name in the project list.
        {:else if mode === 'delete'}
          Deleting a non-last sibling shifts later paths too. Example: delete `1/2`, old `1/3`
          becomes `1/2`.
        {:else if mode === 'order'}
          Saving order changes child paths and path-based endpoints. Example: moving `1/3` above
          `1/2` swaps those paths.
        {:else}
          Cannot be undone from the editor.
        {/if}
      </p>

      <div class="flex justify-center gap-2 pt-0.5">
        <Button variant="outline" size="sm" disabled={inFlight} onclick={() => (open = false)}>
          Keep editing
        </Button>
        <Button
          size="sm"
          variant={mode === 'delete' ? 'destructive' : 'default'}
          onclick={handleConfirm}
          disabled={!can_save}
        >
          {save_label}
        </Button>
      </div>
    </div>

    <div
      class="max-h-[45vh] min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-2"
    >
      <p class="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Details
      </p>
      {#if mode === 'delete'}
        <DeleteImpactTable {project_id} rows={delete_review_rows} compact />
      {:else}
        <ChangesPanel
          compact
          editor_mode={mode}
          {order_dirty}
          {metadata_dirty}
          {delete_dirty}
          {active_diff_state}
          {pending_swaps}
          {diffState}
          {workingMap}
        />
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
