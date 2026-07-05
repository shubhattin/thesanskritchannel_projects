<script lang="ts">
  import { Toggle } from '$lib/components/ui/toggle';
  import Italic from '@lucide/svelte/icons/italic';
  import { cn } from '$lib/utils';

  type Props = {
    label?: string;
    value: boolean;
    onchange: (italic: boolean) => void;
    disabled?: boolean;
  };

  let { label = 'Style', value, onchange, disabled = false }: Props = $props();

  let pressed = $state(false);

  $effect(() => {
    pressed = value;
  });

  function handle_pressed_change(italic: boolean) {
    pressed = italic;
    onchange(italic);
  }
</script>

<Toggle
  bind:pressed
  variant="outline"
  size="sm"
  {disabled}
  aria-label="{label} italic"
  title="{label}: {pressed ? 'Italic' : 'Upright'}"
  class={cn(
    'size-7 shrink-0 p-0',
    'data-[state=on]:border-primary/50 data-[state=on]:bg-primary/15',
    'data-[state=on]:*:[svg]:fill-primary/25 data-[state=on]:*:[svg]:stroke-primary'
  )}
  onPressedChange={handle_pressed_change}
>
  <Italic class="size-4" />
</Toggle>
