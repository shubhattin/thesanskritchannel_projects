<script lang="ts">
  import { ChevronDown, Info } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Popover from '$lib/components/ui/popover';
  import {
    format_path_short_label,
    default_tree_expanded_paths,
    full_path_from_subtree_path
  } from '~/components/pages/map_edit/map_edit_lib';
  import SearchPathTree from './SearchPathTree.svelte';
  import { normalize_search_path_prefixes } from '~/utils/search/search_path_prefixes';

  let {
    selected_project_ids,
    path_prefixes = $bindable<number[][] | undefined>(undefined),
    path_filter_text = $bindable('')
  }: {
    selected_project_ids: Set<number>;
    path_prefixes?: number[][] | undefined;
    path_filter_text?: string;
  } = $props();

  let path_tree_open = $state(false);
  let checked_rel_paths = $state<Set<string>>(new Set());
  let expanded_paths = $state(default_tree_expanded_paths());
  let last_single_project_id = $state<number | null>(null);

  const rel_paths_from_prefixes = (prefixes: number[][] | undefined) =>
    new Set((prefixes ?? []).map((pp) => pp.join('.')));

  const single_project_id = $derived.by((): number | null => {
    if (selected_project_ids.size !== 1) return null;
    return [...selected_project_ids][0] ?? null;
  });

  const path_tree_button_label = $derived.by(() => {
    if (!path_prefixes || path_prefixes.length === 0) return '/';
    if (path_prefixes.length === 1) return format_path_short_label(path_prefixes[0]!);
    return `${path_prefixes.length} sections`;
  });

  const parse_path_params = (t: string): number[] | undefined => {
    const trimmed = t.trim();
    if (!trimmed || !/^\d+(?::\d+)*$/.test(trimmed)) return undefined;
    return trimmed.split(':').map((v) => parseInt(v, 10));
  };

  $effect(() => {
    const id = single_project_id;
    if (id === last_single_project_id) return;
    last_single_project_id = id;
    if (id === null) {
      checked_rel_paths = new Set();
      expanded_paths = default_tree_expanded_paths();
      return;
    }
    checked_rel_paths = rel_paths_from_prefixes(path_prefixes);
    expanded_paths = default_tree_expanded_paths();
  });

  $effect(() => {
    if (single_project_id === null) return;
    const prefixes = [...checked_rel_paths]
      .filter((p) => p !== '')
      .map((p) => full_path_from_subtree_path([], p));
    path_prefixes = normalize_search_path_prefixes(prefixes.length > 0 ? prefixes : undefined);
  });

  $effect(() => {
    if (single_project_id !== null) return;
    const parsed = parse_path_params(path_filter_text);
    path_prefixes = normalize_search_path_prefixes(parsed ? [parsed] : undefined);
  });
</script>

{#if selected_project_ids.size === 0}
  <div class="space-y-2">
    <Label class="text-sm font-medium">Path filter</Label>
    <p class="text-sm text-muted-foreground">Select a text to configure path filtering.</p>
  </div>
{:else if single_project_id !== null}
  <div class="space-y-2">
    <Label class="text-sm font-medium">Path filter</Label>
    <Button
      type="button"
      variant="outline"
      class="w-full justify-between font-normal"
      aria-label="Select sections to search"
      onclick={() => (path_tree_open = true)}
    >
      <span class="truncate font-mono">{path_tree_button_label}</span>
      <ChevronDown class="size-4 shrink-0 opacity-50" />
    </Button>
    <Dialog.Root bind:open={path_tree_open}>
      <Dialog.Content
        class="flex max-h-[min(85vh,720px)] w-[min(36rem,95vw)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <SearchPathTree
          project_id={single_project_id}
          bind:checked_paths={checked_rel_paths}
          bind:expanded_paths
          embedded
        />
      </Dialog.Content>
    </Dialog.Root>
  </div>
{:else}
  <div class="space-y-2">
    <div class="flex items-center gap-1.5">
      <Label for="path-filter" class="text-sm font-medium">Path filter</Label>
      <Popover.Root>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              variant="ghost"
              size="icon"
              class="size-7"
              aria-label="Path filter information"
            >
              <Info class="size-4 text-muted-foreground" />
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content
          class="max-w-xs border-border bg-card p-3 text-sm text-card-foreground shadow-md"
          side="top"
        >
          Path filters use numeric segments only (e.g. 1:2). The same filter applies to all selected
          texts. For interactive section picking, select a single text.
        </Popover.Content>
      </Popover.Root>
    </div>
    <Input
      id="path-filter"
      name="path_filter"
      placeholder="e.g. 1:2"
      form="search-form"
      bind:value={path_filter_text}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (document.getElementById('search-form') as HTMLFormElement | null)?.requestSubmit();
        }
      }}
    />
  </div>
{/if}
