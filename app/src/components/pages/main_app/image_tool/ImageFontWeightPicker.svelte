<script lang="ts">
  import { Toggle } from '$lib/components/ui/toggle';
  import Bold from '@lucide/svelte/icons/bold';
  import { cn } from '$lib/utils';
  import {
    BOLD_FONT_WEIGHT,
    REGULAR_FONT_WEIGHT,
    is_bold_font_weight,
    type ImageFontWeightOption
  } from './image_font_weight';

  type Props = {
    label?: string;
    value: number;
    onchange: (weight: ImageFontWeightOption) => void;
    disabled?: boolean;
  };

  let { label = 'Weight', value, onchange, disabled = false }: Props = $props();

  let pressed = $state(false);

  $effect(() => {
    pressed = is_bold_font_weight(value);
  });

  function handle_pressed_change(bold: boolean) {
    pressed = bold;
    onchange(bold ? BOLD_FONT_WEIGHT : REGULAR_FONT_WEIGHT);
  }
</script>

<Toggle
  bind:pressed
  variant="outline"
  size="sm"
  {disabled}
  aria-label="{label} bold"
  title="{label}: {pressed ? 'Bold' : 'Regular'}"
  class={cn(
    'size-7 shrink-0 p-0',
    'data-[state=on]:border-primary/50 data-[state=on]:bg-primary/15',
    'data-[state=on]:*:[svg]:fill-primary/25 data-[state=on]:*:[svg]:stroke-primary'
  )}
  onPressedChange={handle_pressed_change}
>
  <Bold class="size-4" />
</Toggle>
