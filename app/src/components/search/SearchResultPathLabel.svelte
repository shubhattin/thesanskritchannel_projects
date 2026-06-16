<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import {
    format_path_resolved_label,
    format_path_short_label,
    type MapNodeWithClientId
  } from '~/components/pages/map_edit/map_edit_lib';
  import type { recursive_list_type } from '~/state/data_types';
  import { dbPathToPathParams } from '~/utils/map_path/swap';

  let {
    map,
    db_path
  }: {
    map: recursive_list_type | null | undefined;
    db_path: string;
  } = $props();

  const path_params = $derived(!db_path ? [] : dbPathToPathParams(db_path));
  const short = $derived(format_path_short_label(path_params));
  const resolved = $derived(
    map ? format_path_resolved_label(map as MapNodeWithClientId, path_params) : short
  );
</script>

<Tooltip.Root>
  <Tooltip.Trigger
    type="button"
    class="inline max-w-full min-w-0 cursor-default truncate rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ring-1 ring-border/50"
  >
    {short}
  </Tooltip.Trigger>
  <Tooltip.Content
    side="top"
    class="max-w-sm border border-border bg-popover text-xs leading-snug text-popover-foreground shadow-md"
  >
    {resolved}
  </Tooltip.Content>
</Tooltip.Root>
