<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { project_map_q_options } from '~/state/main_app/data.svelte';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { build_main_site_project_link } from '~/utils/main_site_url';
  import { cn } from '$lib/utils';
  import ExternalLink from '@lucide/svelte/icons/external-link';

  let {
    use_selected_levels = true,
    class: className = ''
  }: {
    use_selected_levels?: boolean;
    class?: string;
  } = $props();

  const project_map_q = createQuery(() => project_map_q_options($project_state));

  const link = $derived.by(() => {
    const state = $project_state;
    if (!state?.project_key || !state.listed || !project_map_q.isSuccess) return null;
    return build_main_site_project_link({
      project_key: state.project_key,
      map: project_map_q.data,
      selected_text_levels: use_selected_levels ? $selected_text_levels : null,
      levels: state.levels
    });
  });
</script>

{#if link}
  <a
    href={link.href}
    target="_blank"
    rel="noopener noreferrer"
    class={cn(
      'inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-primary transition-colors hover:bg-accent hover:text-accent-foreground sm:text-sm',
      className
    )}
  >
    <ExternalLink class="size-3.5 shrink-0" aria-hidden="true" />
    <span class="whitespace-nowrap">Main Site Page</span>
    <!-- <span class="truncate font-mono text-[11px] text-muted-foreground sm:text-xs">{link.path}</span> -->
    <span class="sr-only">(opens in a new tab)</span>
  </a>
{/if}
