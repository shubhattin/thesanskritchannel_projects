<script lang="ts">
  import * as InputGroup from '$lib/components/ui/input-group';
  import PaletteIcon from '@lucide/svelte/icons/palette';
  import { colorToHex } from './color_utils';

  type Props = {
    label: string;
    value: string;
    onValueChange: (value: string) => void;
  };

  let { label, value, onValueChange }: Props = $props();

  let color_input = $state<HTMLInputElement | null>(null);
  const picker_hex = $derived(colorToHex(value));
  const picker_id = $derived(`image-color-${label.replace(/\s+/g, '-').toLowerCase()}`);
</script>

<div class="flex min-w-0 items-center gap-2">
  <button
    type="button"
    class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    aria-label={`Open color picker for ${label}`}
    title="Choose color"
    onclick={() => color_input?.click()}
  >
    <PaletteIcon class="size-3.5" />
  </button>
  <span class="w-22 shrink-0 truncate text-sm text-muted-foreground" title={label}>
    {label}
  </span>
  <InputGroup.Root class="h-8 min-w-0 flex-1">
    <InputGroup.Addon align="inline-start" class="px-1">
      <label
        for={picker_id}
        class="relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border border-input"
        style:background-color={picker_hex}
        title="Choose color"
      >
        <input
          bind:this={color_input}
          id={picker_id}
          type="color"
          class="absolute inset-0 cursor-pointer opacity-0"
          value={picker_hex}
          oninput={(e) => onValueChange((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
    </InputGroup.Addon>
    <InputGroup.Input
      class="min-w-0 font-mono text-xs"
      {value}
      placeholder="#hex or hsla(...)"
      oninput={(e) => onValueChange((e.currentTarget as HTMLInputElement).value)}
    />
  </InputGroup.Root>
</div>
