<script lang="ts">
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import BanIcon from '@lucide/svelte/icons/ban';

  export type TextSiblingNavigationItem = {
    href: string;
    name_display: string;
    disabled?: boolean;
  };

  type Props = {
    previous_item: TextSiblingNavigationItem | null;
    next_item: TextSiblingNavigationItem | null;
    script_font_class: string;
    aria_label?: string;
  };

  let {
    previous_item,
    next_item,
    script_font_class,
    aria_label = 'Previous and next texts'
  }: Props = $props();

  const has_navigation = $derived(previous_item !== null || next_item !== null);
</script>

{#if has_navigation}
  <nav aria-label={aria_label} class="flex flex-wrap gap-3">
    {#if previous_item}
      {#if previous_item.disabled}
        <div
          class="flex w-full min-w-0 cursor-not-allowed items-center gap-4 rounded-xl border border-dashed bg-muted/30 p-4 opacity-70 sm:w-[calc(50%-0.375rem)]"
          aria-disabled="true"
          title="No text available for this section"
        >
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <BanIcon class="size-4 text-muted-foreground/80" />
          </div>
          <div class="min-w-0 flex-1 space-y-0.5">
            <p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Previous
            </p>
            <p class={`truncate text-base font-medium ${script_font_class}`}>
              {previous_item.name_display}
            </p>
          </div>
        </div>
      {:else}
        <a
          class="card-hover-glow group flex w-full min-w-0 items-center gap-4 rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary/30 sm:w-[calc(50%-0.375rem)]"
          href={previous_item.href}
        >
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary"
          >
            <ChevronLeftIcon class="size-4" />
          </div>
          <div class="min-w-0 flex-1 space-y-0.5">
            <p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Previous
            </p>
            <p class={`truncate text-base font-medium ${script_font_class}`}>
              {previous_item.name_display}
            </p>
          </div>
        </a>
      {/if}
    {/if}

    {#if next_item}
      {#if next_item.disabled}
        <div
          class="flex w-full min-w-0 cursor-not-allowed items-center gap-4 rounded-xl border border-dashed bg-muted/30 p-4 text-left opacity-70 sm:ml-auto sm:w-[calc(50%-0.375rem)] sm:text-right"
          aria-disabled="true"
          title="No text available for this section"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Next
            </p>
            <p class={`truncate text-base font-medium ${script_font_class}`}>
              {next_item.name_display}
            </p>
          </div>
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <BanIcon class="size-4 text-muted-foreground/80" />
          </div>
        </div>
      {:else}
        <a
          class="card-hover-glow group flex w-full min-w-0 items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors duration-150 hover:border-primary/30 sm:ml-auto sm:w-[calc(50%-0.375rem)] sm:text-right"
          href={next_item.href}
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Next
            </p>
            <p class={`truncate text-base font-medium ${script_font_class}`}>
              {next_item.name_display}
            </p>
          </div>
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary"
          >
            <ChevronRightIcon
              class="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </div>
        </a>
      {/if}
    {/if}
  </nav>
{/if}
