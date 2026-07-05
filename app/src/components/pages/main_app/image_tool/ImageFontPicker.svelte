<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import { Separator } from '$lib/components/ui/separator';
  import { Input } from '$lib/components/ui/input';
  import { BUNDLED_FONT_OPTIONS, type fonts_type } from '~/tools/font_tools';
  import {
    load_system_font_families,
    system_font_families,
    system_fonts_available,
    system_fonts_loading
  } from './system_fonts';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { cn } from '$lib/utils';

  type Props = {
    label: string;
    effectiveFamily: string;
    bundledKey: string | null;
    systemFamily: string | null;
    isDefault: boolean;
    disabled?: boolean;
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
</script>

<div class="space-y-0.5">
  <div class="flex items-center justify-between gap-2">
    <span class="text-[13px] text-muted-foreground">{label}</span>
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
  </div>

  <Popover.Root bind:open>
    <Popover.Trigger
      type="button"
      {disabled}
      class={cn(
        'flex h-7 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-[13px] shadow-xs ring-offset-background outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50'
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
                show_bundled_selection && bundledKey === option.key ? 'opacity-100' : 'opacity-0'
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
          {#each filtered_system as family (family)}
            <button
              type="button"
              class={cn(item_class, is_system_preview && systemFamily === family && 'bg-accent')}
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
        {/if}

        <div
          class="mx-0.5 mt-1 flex items-start gap-1 rounded-md bg-amber-500/10 px-1.5 py-1 text-[10px] leading-snug text-amber-900 dark:text-amber-200"
        >
          <TriangleAlert class="mt-px size-2.5 shrink-0" />
          <span>System fonts may be unavailable on other devices; project fonts are used as fallback.</span>
        </div>
      </div>
    </Popover.Content>
  </Popover.Root>
</div>
