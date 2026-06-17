<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import type { recursive_list_type } from '~/state/data_types';
  import MapNodePathLabels from './MapNodePathLabels.svelte';
  import { apply_map_metadata_patch } from './map_metadata_patch';
  import type { MapMetadataSaveMutation, MapMetadataTypeConvertTarget } from './map_metadata_save';

  export type QuickConvertTypeTarget = {
    path: number[];
    target: MapMetadataTypeConvertTarget;
    node_name: string;
    map: recursive_list_type;
  };

  let {
    open = $bindable(false),
    target = $bindable<QuickConvertTypeTarget | null>(null),
    project_id,
    save_mut
  }: {
    open?: boolean;
    target?: QuickConvertTypeTarget | null;
    project_id: number;
    save_mut: MapMetadataSaveMutation;
  } = $props();

  const from_type = $derived(target?.target === 'to_shloka' ? 'List' : 'Shloka');
  const to_type = $derived(target?.target === 'to_shloka' ? 'Shloka' : 'List');

  function close() {
    open = false;
    target = null;
  }

  async function confirm_convert() {
    if (!target) return;
    const patch =
      target.target === 'to_shloka'
        ? ({ kind: 'convert_to_shloka', path: target.path } as const)
        : ({ kind: 'convert_to_list', path: target.path } as const);
    try {
      await save_mut.mutateAsync({
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

<AlertDialog.Root bind:open onOpenChange={(v) => !v && close()}>
  <AlertDialog.Content class="max-w-md">
    <AlertDialog.Header>
      <AlertDialog.Title>Convert node type?</AlertDialog.Title>
      <AlertDialog.Description class="space-y-2 text-sm text-muted-foreground">
        {#if target}
          <MapNodePathLabels map={target.map} path={target.path} />
          <p>
            Convert <span class="font-medium text-foreground">{target.node_name}</span> from
            <span class="font-medium text-foreground">{from_type}</span> to
            <span class="font-medium text-foreground">{to_type}</span>? This updates the project map
            immediately.
          </p>
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={save_mut.isPending}>Cancel</AlertDialog.Cancel>
      <Button disabled={!target || save_mut.isPending} onclick={confirm_convert}>
        {#if save_mut.isPending}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        Convert to {to_type}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
