<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
  import SearchIcon from '@lucide/svelte/icons/search';

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

  const query = $derived(search.trim().toLowerCase());
  const filtered = $derived(
    query.length === 0
      ? items
      : items.filter(
          (item) =>
            item.name_display.toLowerCase().includes(query) ||
            item.name_dev.toLowerCase().includes(query)
        )
  );
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
    <Dialog.Content class="flex max-h-[85vh] max-w-lg flex-col">
      <Dialog.Header>
        <Dialog.Title class={script_font_class}>{parent_name}</Dialog.Title>
        <Dialog.Description>
          {items.length}
          {level_label.toLowerCase()} — jump to any section
        </Dialog.Description>
      </Dialog.Header>
      <div class="relative shrink-0 px-6">
        <SearchIcon
          class="pointer-events-none absolute top-1/2 left-9 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          bind:value={search}
          placeholder="Search {level_label.toLowerCase()}…"
          autocomplete="off"
          class="pl-9"
        />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {#if filtered.length === 0}
          <p class="py-8 text-center text-sm text-muted-foreground">No matches for “{search}”.</p>
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
