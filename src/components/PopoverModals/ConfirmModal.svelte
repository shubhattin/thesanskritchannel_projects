<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    children,
    popup_state = $bindable(),
    title,
    body_text,
    body,
    cancel_func,
    confirm_func,
    close_on_confirm = false,
    class: className,
    button_pos = 'center'
  }: {
    children?: Snippet;
    confirm_func?: () => void;
    cancel_func?: () => void;
    title: string;
    body_text?: () => string;
    body?: Snippet;
    popup_state: boolean;
    close_on_confirm?: boolean;
    class?: string;
    button_pos?: 'left' | 'center' | 'right';
  } = $props();
</script>

<AlertDialog.Root bind:open={popup_state}>
  {#if children}
    <AlertDialog.Trigger>
      {@render children()}
    </AlertDialog.Trigger>
  {/if}
  <AlertDialog.Content class="max-w-md">
    <AlertDialog.Header>
      <AlertDialog.Title class={cn('text-lg font-bold', className)}>{title}</AlertDialog.Title>
      {#if body}
        <AlertDialog.Description>
          <div class="my-2">
            {@render body()}
          </div>
        </AlertDialog.Description>
      {:else if body_text}
        <AlertDialog.Description>
          <div class="my-2">
            {@html body_text()}
          </div>
        </AlertDialog.Description>
      {/if}
    </AlertDialog.Header>
    <AlertDialog.Footer
      class={cn(
        'flex gap-2',
        button_pos === 'center' && 'justify-center',
        button_pos === 'right' && 'justify-end',
        button_pos === 'left' && 'justify-start'
      )}
    >
      <AlertDialog.Cancel
        class="rounded-lg border border-border bg-background px-4 py-2 font-semibold hover:bg-muted"
        onclick={() => {
          cancel_func?.();
        }}
      >
        Cancel
      </AlertDialog.Cancel>
      <AlertDialog.Action
        class="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
        onclick={() => {
          if (close_on_confirm) popup_state = false;
          confirm_func?.();
        }}
      >
        Confirm
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
