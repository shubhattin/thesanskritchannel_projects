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
    if (!state?.project_key || !project_map_q.isSuccess) return null;
    // Unlisted projects are shared via the `{key}-{uid}` preview URL (not publicly listed).
    const site_key =
      !state.listed && state.project_uid
        ? `${state.project_key}-${state.project_uid}`
        : state.project_key;
    const built = build_main_site_project_link({
      project_key: site_key,
      map: project_map_q.data,
      selected_text_levels: use_selected_levels ? $selected_text_levels : null,
      levels: state.levels
    });
    if (!built) return null;
    return { ...built, is_preview: !state.listed };
  });
</script>

{#if link}
  <a
    href={link.href}
    target="_blank"
    rel="noopener noreferrer"
    title={link.is_preview
      ? 'Unlisted project — shareable preview link; not visible on the public site'
      : 'Open on the main site'}
    class={cn(
      'inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-primary transition-colors hover:bg-accent hover:text-accent-foreground sm:text-sm',
      className
    )}
  >
    <ExternalLink class="size-3.5 shrink-0" aria-hidden="true" />
    <span class="whitespace-nowrap">{link.is_preview ? 'Preview on Main Site' : 'Main Site Page'}</span>
    {#if link.is_preview}
      <span
        class="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-amber-700 dark:text-amber-300"
      >
        unlisted
      </span>
    {/if}
    <!-- <span class="truncate font-mono text-[11px] text-muted-foreground sm:text-xs">{link.path}</span> -->
    <span class="sr-only">(opens in a new tab)</span>
  </a>
{/if}
