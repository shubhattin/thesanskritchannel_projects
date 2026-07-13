<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Separator } from '$lib/components/ui/separator';
  import Icon from '~/tools/Icon.svelte';
  import { BsDownload, BsThreeDots } from 'svelte-icons-pack/bs';
  import { toast } from 'svelte-sonner';
  import {
    download_s3_webp_in_browser,
    download_webp_as_png_in_browser
  } from '~/tools/download_file_browser';
  import { get_non_square_aspect_ratio_label } from '~/utils/image_assets/aspect_ratio';

  type Props = {
    url: string;
    s3_key: string;
    alt?: string;
    width: number;
    height: number;
    /** Label under the image, e.g. `0:1` or `orphan` */
    label: string;
    /** Basename without extension, e.g. `Image Index No. 3 Shloka No. 12` */
    download_basename?: string;
    on_delete?: () => void | Promise<void>;
    deleting?: boolean;
  };

  let {
    url,
    s3_key,
    alt = '',
    width,
    height,
    label,
    download_basename = 'Image Index No. orphan',
    on_delete,
    deleting = false
  }: Props = $props();

  let menu_open = $state(false);
  let confirm_open = $state(false);
  let webp_downloading = $state(false);
  let png_downloading = $state(false);
  const aspect = $derived(get_non_square_aspect_ratio_label(width, height));
  const show_menu = $derived(!!s3_key || !!on_delete);

  const download_webp = async () => {
    if (!s3_key || webp_downloading) return;
    webp_downloading = true;
    try {
      await download_s3_webp_in_browser(s3_key, download_basename);
      menu_open = false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'WebP download failed');
    } finally {
      webp_downloading = false;
    }
  };

  const download_png = async () => {
    if (!s3_key || png_downloading) return;
    png_downloading = true;
    try {
      await download_webp_as_png_in_browser(s3_key, download_basename);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PNG download failed');
    } finally {
      png_downloading = false;
    }
  };
</script>

<div class="flex flex-col gap-1.5">
  <div class="relative aspect-square overflow-hidden rounded-md border border-border bg-muted/20">
    <img src={url} {alt} class="size-full object-cover" loading="lazy" />
    {#if show_menu}
      <div class="absolute top-1.5 right-1.5">
        <Popover.Root bind:open={menu_open}>
          <Popover.Trigger
            class="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background/90 shadow-sm outline-none"
            aria-label="Image actions"
          >
            <Icon src={BsThreeDots} class="text-base" />
          </Popover.Trigger>
          <Popover.Content class="w-44 p-1" align="end">
            {#if s3_key}
              <Button
                variant="ghost"
                class="w-full justify-start gap-2"
                disabled={webp_downloading}
                onclick={() => void download_webp()}
              >
                <Icon src={BsDownload} class="text-base" />
                {webp_downloading ? 'Downloading…' : 'Download WebP'}
              </Button>
            {/if}
            {#if s3_key && on_delete}
              <Separator class="my-1" />
            {/if}
            {#if on_delete}
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
            {/if}
          </Popover.Content>
        </Popover.Root>
      </div>
    {/if}
  </div>
  <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
    <span class="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
    {#if aspect}
      <span class="rounded bg-muted px-1.5 py-0.5">{aspect}</span>
    {/if}
    {#if s3_key}
      <Button
        variant="outline"
        size="sm"
        class="h-7 gap-1 px-2 text-xs"
        disabled={png_downloading}
        onclick={() => void download_png()}
        title="Download PNG"
      >
        <Icon src={BsDownload} class="text-sm" />
        {png_downloading ? '…' : 'PNG'}
      </Button>
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
            try {
              await on_delete();
              confirm_open = false;
            } catch {
              // Keep dialog open; parent mutation onError already toasts.
            }
          }}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
