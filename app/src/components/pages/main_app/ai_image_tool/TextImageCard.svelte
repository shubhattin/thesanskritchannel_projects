<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import Icon from '~/tools/Icon.svelte';
  import { BsThreeDots } from 'svelte-icons-pack/bs';
  import { get_non_square_aspect_ratio_label } from '~/utils/image_assets/aspect_ratio';

  type Props = {
    url: string;
    alt?: string;
    width: number;
    height: number;
    /** Label under the image, e.g. `0:1` or `orphan` */
    label: string;
    on_delete?: () => void | Promise<void>;
    deleting?: boolean;
  };

  let { url, alt = '', width, height, label, on_delete, deleting = false }: Props = $props();

  let menu_open = $state(false);
  let confirm_open = $state(false);
  const aspect = $derived(get_non_square_aspect_ratio_label(width, height));
</script>

<div class="flex flex-col gap-1.5">
  <div class="relative aspect-square overflow-hidden rounded-md border border-border bg-muted/20">
    <img src={url} {alt} class="size-full object-cover" loading="lazy" />
    {#if on_delete}
      <div class="absolute top-1.5 right-1.5">
        <Popover.Root bind:open={menu_open}>
          <Popover.Trigger
            class="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background/90 shadow-sm outline-none"
            aria-label="Image actions"
          >
            <Icon src={BsThreeDots} class="text-base" />
          </Popover.Trigger>
          <Popover.Content class="w-36 p-1" align="end">
            <Button
              variant="ghost"
              class="w-full justify-start text-destructive hover:text-destructive"
              onclick={() => {
                menu_open = false;
                confirm_open = true;
              }}
            >
              Delete
            </Button>
          </Popover.Content>
        </Popover.Root>
      </div>
    {/if}
  </div>
  <div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
    <span class="font-medium text-foreground">{label}</span>
    {#if aspect}
      <span class="rounded bg-muted px-1.5 py-0.5">{aspect}</span>
    {/if}
  </div>
</div>

{#if on_delete}
  <AlertDialog.Root bind:open={confirm_open}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Delete image?</AlertDialog.Title>
        <AlertDialog.Description>
          This permanently removes the image from storage. This cannot be undone.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action
          disabled={deleting}
          onclick={async () => {
            await on_delete();
            confirm_open = false;
          }}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
