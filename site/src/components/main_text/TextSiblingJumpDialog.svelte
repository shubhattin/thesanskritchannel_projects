<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import * as InputGroup from '$lib/components/ui/input-group';
  import { Switch } from '$lib/components/ui/switch';
  import SearchIcon from '@lucide/svelte/icons/search';
  import KeyboardIcon from '@lucide/svelte/icons/keyboard';
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
  import { clearTypingContextOnKeyDown, handleTypingBeforeInputEvent } from 'lipilekhika/typing';
  import {
    matches_script_search,
    tokenize_search_query
  } from '@app/utils/search/project_list_search';
  import { create_project_name_dev_normal_cache } from '@app/utils/search/project_name_dev_normal_cache';
  import { use_script_query } from '$lib/search/use-script-query.svelte';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';

  export type SiblingJumpItem = {
    href: string;
    name_display: string;
    name_dev: string;
    disabled?: boolean;
  };

  type Props = {
    items: SiblingJumpItem[];
    /** 1-based position of the current page within `items`; null when unknown. */
    current_position: number | null;
    /** Plural label for the sibling level, e.g. "Chapters". */
    level_label: string;
    /** Display name of the parent (dialog title). */
    parent_name: string;
    script_font_class: string;
  };

  let { items, current_position, level_label, parent_name, script_font_class }: Props = $props();

  let open = $state(false);
  let search = $state('');
  /** LipiLekhika transliteration typing; off by default like the Texts/Lekha browsers. */
  let typing_enabled = $state(false);

  const script_query = use_script_query(() => search);
  const name_dev_normal_cache = create_project_name_dev_normal_cache();
  let normals_version = $state(0);

  $effect(() => {
    const name_devs = items.map((item) => item.name_dev);
    void name_dev_normal_cache.ensure_all(name_devs).then(() => {
      normals_version++;
    });
  });

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }

  const filtered = $derived.by(() => {
    void normals_version;
    const words = tokenize_search_query(search);
    if (words.length === 0) return items;
    const query_normals = script_query.normals_for_text(search);
    return items.filter((item) =>
      matches_script_search(
        { words, normals: query_normals },
        {
          direct: [item.name_dev, name_dev_normal_cache.get(item.name_dev), item.name_display],
          fuzzy: [item.name_dev, name_dev_normal_cache.get(item.name_dev), item.name_display]
        }
      )
    );
  });
</script>

{#if items.length > 1}
  <div class="flex w-full justify-center">
    <button
      type="button"
      onclick={() => {
        search = '';
        open = true;
      }}
      title="Browse all {items.length} {level_label.toLowerCase()}"
      class="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <LayoutGridIcon class="size-3.5" aria-hidden="true" />
      All {items.length}
      {level_label.toLowerCase()}
    </button>
  </div>

  <Dialog.Root
    bind:open
    onOpenChange={(next) => {
      if (!next) search = '';
    }}
  >
    <Dialog.Content
      class="flex max-h-[85vh] max-w-lg flex-col"
      onOpenAutoFocus={(e) => {
        if (typeof window === 'undefined') return;
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        const narrow = window.innerWidth < 640;
        if (coarse || narrow) e.preventDefault();
      }}
    >
      <Dialog.Header>
        <Dialog.Title class={script_font_class}>{parent_name}</Dialog.Title>
        <Dialog.Description>
          {items.length}
          {level_label.toLowerCase()} — jump to any section
        </Dialog.Description>
      </Dialog.Header>
      <div class="shrink-0 px-6">
        <InputGroup.Root>
          <InputGroup.Addon align="inline-start" class="pl-2.5">
            <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
          </InputGroup.Addon>
          <InputGroup.Input
            placeholder="Search {level_label.toLowerCase()}…"
            bind:value={search}
            onbeforeinput={(e) =>
              handleTypingBeforeInputEvent(
                script_query.ctx,
                e,
                (newValue) => {
                  search = newValue;
                },
                typing_enabled
              )}
            onblur={() => script_query.ctx.clearContext()}
            onkeydown={(e) => {
              if (toggle_typing_from_keyboard(e)) return;
              clearTypingContextOnKeyDown(e, script_query.ctx);
            }}
            aria-label="Search {level_label.toLowerCase()}"
            autocomplete="off"
          />
          <InputGroup.Addon
            align="inline-end"
            class="cursor-default gap-2 border-s border-border/50 ps-3 pe-2.5"
            title={`${site_prefs.script} transliteration typing (Alt+X)`}
          >
            <KeyboardIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
            <Switch
              bind:checked={typing_enabled}
              aria-label="Transliteration typing"
              title={`${site_prefs.script} transliteration typing (Alt+X)`}
            />
          </InputGroup.Addon>
        </InputGroup.Root>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {#if filtered.length === 0}
          <div class="space-y-1 py-8 text-center">
            <p class="text-sm text-muted-foreground">No matches for “{search}”.</p>
            <p class="text-xs text-muted-foreground/70">
              Try a different term, or enable transliteration typing to search in {site_prefs.script}.
            </p>
          </div>
        {:else}
          <ul class="flex flex-col gap-1.5">
            {#each filtered as item (item.href + item.name_dev)}
              {@const position = items.indexOf(item) + 1}
              {@const is_current = current_position !== null && position === current_position}
              <li>
                {#if is_current}
                  <span
                    class="flex items-center gap-3 rounded-xl border border-primary/50 bg-primary/5 p-3"
                    aria-current="page"
                  >
                    <span
                      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary"
                      style="font-variant-numeric: tabular-nums;"
                    >
                      {position}
                    </span>
                    <span
                      class={`min-w-0 flex-1 truncate text-sm font-medium ${script_font_class}`}
                    >
                      {item.name_display}
                    </span>
                  </span>
                {:else if item.disabled}
                  <span
                    class="flex cursor-not-allowed items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-3 opacity-70"
                    aria-disabled="true"
                    title="No text available for this section"
                  >
                    <span
                      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
                      style="font-variant-numeric: tabular-nums;"
                    >
                      {position}
                    </span>
                    <span
                      class={`min-w-0 flex-1 truncate text-sm font-medium ${script_font_class}`}
                    >
                      {item.name_display}
                    </span>
                  </span>
                {:else}
                  <a
                    class="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors duration-150 hover:border-primary/30"
                    href={item.href}
                  >
                    <span
                      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary"
                      style="font-variant-numeric: tabular-nums;"
                    >
                      {position}
                    </span>
                    <span
                      class={`min-w-0 flex-1 truncate text-sm font-medium ${script_font_class}`}
                    >
                      {item.name_display}
                    </span>
                  </a>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
