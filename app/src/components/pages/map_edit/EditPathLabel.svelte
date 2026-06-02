<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import {
    type MapNodeWithClientId,
    type MapPath,
    format_path_resolved_label,
    format_path_short_label
  } from './map_edit_lib';

  let {
    map,
    path,
    variant = 'resolved'
  }: {
    map: MapNodeWithClientId;
    path: MapPath;
    variant?: 'resolved' | 'short';
  } = $props();

  const resolved = $derived(format_path_resolved_label(map, path));
  const short = $derived(format_path_short_label(path));
</script>

{#if variant === 'resolved'}
  <span class="text-xs leading-snug text-foreground" title={resolved}>{resolved}</span>
{:else}
  <Tooltip.Root>
    <Tooltip.Trigger
      type="button"
      class="inline max-w-full cursor-default truncate rounded bg-background/80 px-1 font-mono text-[10px] text-muted-foreground ring-1 ring-border/60"
    >
      {short}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" class="max-w-sm text-xs leading-snug">
      {resolved}
    </Tooltip.Content>
  </Tooltip.Root>
{/if}
