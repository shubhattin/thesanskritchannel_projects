<script lang="ts">
  import {
    format_path_resolved_label,
    format_path_short_label
  } from '~/components/pages/map_edit/map_edit_lib';
  import type { recursive_list_type } from '~/state/data_types';

  let {
    map,
    path
  }: {
    map: recursive_list_type;
    path: number[];
  } = $props();

  const path_short = $derived(format_path_short_label(path));
  const path_resolved = $derived(format_path_resolved_label(map, path));
</script>

<div class="space-y-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
  <p>
    <span class="font-medium text-muted-foreground">Path:</span>
    <code class="ml-1 font-mono text-xs">{path_short}</code>
  </p>
  <p class="text-muted-foreground">
    <span class="font-medium">Location:</span>
    {path_resolved}
  </p>
</div>
