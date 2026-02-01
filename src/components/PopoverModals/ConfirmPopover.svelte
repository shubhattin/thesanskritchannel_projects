<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  type Placement = 'top' | 'bottom' | 'left' | 'right';

  let {
    children,
    popup_state = $bindable(),
    description,
    cancel_func,
    confirm_func,
    close_on_confirm = false,
    placement = 'bottom',
    class: className
  }: {
    children: Snippet;
    confirm_func?: () => void;
    cancel_func?: () => void;
    description: string;
    popup_state: boolean;
    close_on_confirm?: boolean;
    placement?: Placement;
    class?: string;
  } = $props();
</script>

<Popover.Root bind:open={popup_state}>
  <Popover.Trigger>
    {@render children()}
  </Popover.Trigger>
  <Popover.Content side={placement} class="w-auto space-y-3 p-3">
    <div class={cn('text-base font-semibold', className)}>{description}</div>
    <div class="flex gap-2">
      <button
        class="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        onclick={() => {
          if (close_on_confirm) popup_state = false;
          confirm_func?.();
        }}
      >
        Confirm
      </button>
      <button
        onclick={() => {
          popup_state = false;
          cancel_func?.();
        }}
        class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted"
      >
        Cancel
      </button>
    </div>
  </Popover.Content>
</Popover.Root>
