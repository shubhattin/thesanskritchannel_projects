<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import { Separator } from '$lib/components/ui/separator';
  import { Input } from '$lib/components/ui/input';
  import { BUNDLED_FONT_OPTIONS, type fonts_type } from '~/tools/font_tools';
  import {
    load_system_font_families,
    preload_system_font_families,
    system_font_families,
    system_fonts_available,
    system_fonts_loading
  } from './system_fonts';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { cn } from '$lib/utils';
  import ImageFontWeightPicker from './ImageFontWeightPicker.svelte';
  import ImageFontItalicPicker from './ImageFontItalicPicker.svelte';
  import type { ImageFontWeightOption } from './image_font_weight';

  type Props = {
    label: string;
    effectiveFamily: string;
    bundledKey: string | null;
    systemFamily: string | null;
    isDefault: boolean;
    disabled?: boolean;
    compact?: boolean;
    fontWeight?: number;
    onWeightChange?: (weight: ImageFontWeightOption) => void;
    fontItalic?: boolean;
    onItalicChange?: (italic: boolean) => void;
    onSelectBundled: (key: fonts_type) => void;
    onSelectDefault: () => void;
    onSelectSystem: (family: string) => void;
  };

  let {
    label,
    effectiveFamily,
    bundledKey,
    systemFamily,
    isDefault,
    disabled = false,
    compact = false,
    fontWeight,
    onWeightChange,
    fontItalic,
    onItalicChange,
    onSelectBundled,
    onSelectDefault,
    onSelectSystem
  }: Props = $props();

  let open = $state(false);
  let search = $state('');
  const is_system_preview = $derived(!!systemFamily);
  const show_bundled_selection = $derived(!is_system_preview && !isDefault && !!bundledKey);

  const filtered_bundled = $derived(
    BUNDLED_FONT_OPTIONS.filter(({ family }) =>
      family.toLowerCase().includes(search.trim().toLowerCase())
    )
  );

  const system_list = $derived($system_font_families ?? []);
  const filtered_system = $derived(
    system_list.filter((family) => family.toLowerCase().includes(search.trim().toLowerCase()))
  );
  const SYSTEM_FONT_DISPLAY_CAP = 80;
  const displayed_system = $derived(
    search.trim().length >= 2 ? filtered_system : filtered_system.slice(0, SYSTEM_FONT_DISPLAY_CAP)
  );
  const system_list_capped = $derived(
    filtered_system.length > SYSTEM_FONT_DISPLAY_CAP && search.trim().length < 2
  );
  const system_unavailable = $derived(
    $system_font_families !== null && system_list.length === 0 && !system_fonts_available()
  );
  const system_empty = $derived(
    $system_font_families !== null && system_list.length === 0 && system_fonts_available()
  );

  const item_class =
    'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-[13px] leading-tight hover:bg-accent';

  $effect(() => {
    if (open && $system_font_families === null && !$system_fonts_loading) {
      void load_system_font_families();
    }
  });

  function select_bundled(key: fonts_type) {
    onSelectBundled(key);
    open = false;
    search = '';
  }

  function select_default() {
    onSelectDefault();
    open = false;
    search = '';
  }

  function select_system(family: string) {
    onSelectSystem(family);
    open = false;
    search = '';
  }

  function on_trigger_pointerdown() {
    void preload_system_font_families();
  }
</script>

<div class={cn('min-w-0', compact ? 'space-y-0.5' : 'space-y-0.5')}>
  <div class={cn('flex items-center gap-1', compact ? 'justify-between' : 'justify-between gap-2')}>
    <span
      class={cn(
        'text-muted-foreground',
        compact ? 'text-xs leading-none font-medium' : 'text-[13px]'
      )}
    >
      {label}
    </span>
    {#if !compact}
      {#if is_system_preview}
        <span
          class="rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:text-amber-200"
        >
          System preview
        </span>
      {:else if isDefault}
        <span class="text-[10px] text-muted-foreground">Default</span>
      {:else}
        <span class="text-[10px] font-medium text-foreground/70">Overridden</span>
      {/if}
    {:else if is_system_preview}
      <span class="size-1.5 shrink-0 rounded-full bg-amber-500" title="System font preview"></span>
    {/if}
  </div>

  <div class="flex items-center gap-1">
    <div class="min-w-0 flex-1">
      <Popover.Root bind:open>
        <Popover.Trigger
          type="button"
          {disabled}
          onpointerdown={on_trigger_pointerdown}
          class={cn(
            'flex w-full items-center justify-between rounded-md border border-input bg-background shadow-xs ring-offset-background outline-none',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            compact ? 'h-7 px-2 text-xs' : 'h-7 px-2 text-[13px]'
          )}
        >
          <span class="truncate" style:font-family={effectiveFamily}>{effectiveFamily}</span>
          <ChevronDown class="size-3.5 shrink-0 opacity-50" />
        </Popover.Trigger>
        <Popover.Content class="flex w-64 flex-col p-0" align="start" sideOffset={4}>
          <div class="shrink-0 border-b border-border p-1.5">
            <Input
              bind:value={search}
              placeholder="Search fonts…"
              class="h-7 text-[13px]"
              onkeydown={(e) => e.stopPropagation()}
            />
          </div>

          <div class="max-h-60 overflow-y-auto overscroll-contain p-0.5">
            <p
              class="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Project fonts
            </p>
            <button
              type="button"
              class={cn(item_class, isDefault && !is_system_preview && 'bg-accent')}
              onclick={select_default}
            >
              <Check
                class={cn(
                  'size-3 shrink-0',
                  isDefault && !is_system_preview ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span>Use default</span>
            </button>
            {#each filtered_bundled as option (option.key)}
              <button
                type="button"
                class={cn(
                  item_class,
                  show_bundled_selection && bundledKey === option.key && 'bg-accent'
                )}
                style:font-family={option.family}
                onclick={() => select_bundled(option.key)}
              >
                <Check
                  class={cn(
                    'size-3 shrink-0',
                    show_bundled_selection && bundledKey === option.key
                      ? 'opacity-100'
                      : 'opacity-0'
                  )}
                />
                <span class="truncate">{option.family}</span>
              </button>
            {/each}

            <Separator class="my-1" />

            <p
              class="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              System fonts
            </p>
            {#if $system_fonts_loading && $system_font_families === null}
              <p class="px-1.5 py-1 text-[11px] text-muted-foreground">Loading installed fonts…</p>
            {:else if system_unavailable}
              <p class="px-1.5 py-1 text-[11px] text-muted-foreground">
                System fonts are not available in this browser.
              </p>
            {:else if system_empty}
              <p class="px-1.5 py-1 text-[11px] text-muted-foreground">No system fonts found.</p>
            {:else}
              {#each displayed_system as family (family)}
                <button
                  type="button"
                  class={cn(
                    item_class,
                    is_system_preview && systemFamily === family && 'bg-accent'
                  )}
                  style:font-family={family}
                  onclick={() => select_system(family)}
                >
                  <Check
                    class={cn(
                      'size-3 shrink-0',
                      is_system_preview && systemFamily === family ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span class="truncate">{family}</span>
                </button>
              {/each}
              {#if system_list_capped}
                <p class="px-1.5 py-1 text-[11px] text-muted-foreground">
                  Showing {SYSTEM_FONT_DISPLAY_CAP} of {filtered_system.length}. Type to search for
                  more.
                </p>
              {/if}
            {/if}

            <div
              class="mx-0.5 mt-1 flex items-start gap-1 rounded-md bg-amber-500/10 px-1.5 py-1 text-[10px] leading-snug text-amber-900 dark:text-amber-200"
            >
              <TriangleAlert class="mt-px size-2.5 shrink-0" />
              <span
                >System fonts may be unavailable on other devices; project fonts are used as
                fallback.</span
              >
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
    {#if onWeightChange && fontWeight !== undefined}
      <div class="flex shrink-0 items-center gap-0.5">
        <ImageFontWeightPicker {label} value={fontWeight} onchange={onWeightChange} {disabled} />
        {#if onItalicChange && fontItalic !== undefined}
          <ImageFontItalicPicker {label} value={fontItalic} onchange={onItalicChange} {disabled} />
        {/if}
      </div>
    {/if}
  </div>
</div>
