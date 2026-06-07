<script lang="ts">
  import { get_total_count, project_map_q_options } from '~/state/main_app/data.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { project_state } from '~/state/main_app/state.svelte';
  import Konva from 'konva';
  import {
    image_selected_levels,
    image_script,
    image_shloka,
    scaling_factor,
    shaded_background_image_status,
    BACKGROUND_IMAGE_URLS,
    IMAGE_DIMENSIONS,
    image_lang,
    image_rendering_state,
    zip_download_state,
    stage_node
  } from './image_state';
  import { download_file_in_browser } from '~/tools/download_file_browser';
  import JSZip from 'jszip';
  import { dataURLToBlob } from '~/tools/kry';
  import { BsDownload } from 'svelte-icons-pack/bs';
  import Icon from '~/tools/Icon.svelte';
  import Info from '@lucide/svelte/icons/info';
  import ImageOff from '@lucide/svelte/icons/image-off';
  import ImageIcon from '@lucide/svelte/icons/image';
  import FileArchive from '@lucide/svelte/icons/file-archive';
  import FileImage from '@lucide/svelte/icons/file-image';
  import { compute_all_layouts } from './render_text';
  import * as Popover from '$lib/components/ui/popover';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { ProgressRing } from '$lib/components/ui/progress-ring';
  import { get_path_params } from '~/state/project_list';

  const project_map_q = createQuery(() => project_map_q_options($project_state));

  let total_count = $derived(
    project_map_q.isSuccess
      ? get_total_count($image_selected_levels, project_map_q.data, $project_state?.levels ?? 0)
      : 0
  );
  let image_loc = $derived(
    get_path_params($image_selected_levels, $project_state?.levels ?? 0).join('.')
  );

  const get_image_name = (shloka_index: number, remove_background: boolean) =>
    (image_loc !== '' ? `${image_loc} ` : '') +
    `Index No. ${shloka_index}${remove_background ? '' : ' (with background)'}.png`;

  // --- Single-image download: exports the visible stage (with drag offsets) ---
  const download_image_as_png = async (remove_background: boolean) => {
    const stage = $stage_node;
    if (!stage) return;

    // Layers: 0 = background, 1 = lines, 2 = text+transformer
    const layers = stage.getLayers();
    const bg_layer = layers[0];
    const lines_layer = layers[1];
    const text_layer = layers[2];

    // If template background is showing, swap to normal for export
    const was_template = $shaded_background_image_status;
    let bg_swap_promise: Promise<void> | null = null;
    if (was_template && !remove_background) {
      bg_swap_promise = new Promise<void>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = BACKGROUND_IMAGE_URLS.normal;
        img.onload = () => {
          // Replace the background image node's image
          const bg_image_node = bg_layer?.findOne('Image') as Konva.Image | undefined;
          if (bg_image_node) bg_image_node.image(img);
          resolve();
        };
        img.onerror = () => resolve(); // fall through on error
      });
      await bg_swap_promise;
    }

    // Hide lines layer (not exported)
    lines_layer?.hide();
    // Optionally hide background
    if (remove_background) bg_layer?.hide();

    const url = stage.toDataURL({ pixelRatio: 1 / $scaling_factor });
    const name = get_image_name($image_shloka, remove_background);

    // Restore visibility
    lines_layer?.show();
    if (remove_background) bg_layer?.show();

    // Restore template background if it was swapped
    if (was_template && !remove_background) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = BACKGROUND_IMAGE_URLS.template;
      img.onload = () => {
        const bg_image_node = bg_layer?.findOne('Image') as Konva.Image | undefined;
        if (bg_image_node) bg_image_node.image(img);
        stage.batchDraw();
      };
    }

    stage.batchDraw();
    download_file_in_browser(url, name);
  };

  // --- Offscreen export for bulk downloads (no drag offsets, default positions) ---

  function load_image(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function export_shloka_to_dataurl(
    shloka_index: number,
    opts: { remove_background: boolean }
  ): Promise<{ url: string; name: string }> {
    const layout = await compute_all_layouts(shloka_index, $image_script, $image_lang, true);
    if (!layout) throw new Error(`Failed to compute layout for shloka ${shloka_index}`);

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const stage = new Konva.Stage({
      container,
      width: IMAGE_DIMENSIONS[0],
      height: IMAGE_DIMENSIONS[1]
    });
    const layer = new Konva.Layer();
    stage.add(layer);

    if (!opts.remove_background) {
      const bg_img = await load_image(BACKGROUND_IMAGE_URLS.normal);
      layer.add(
        new Konva.Image({
          image: bg_img,
          x: 0,
          y: 0,
          width: IMAGE_DIMENSIONS[0],
          height: IMAGE_DIMENSIONS[1]
        })
      );
    }

    for (const textCfg of layout.texts) {
      layer.add(
        new Konva.Text({
          text: textCfg.text,
          x: textCfg.x,
          y: textCfg.y,
          fontSize: textCfg.fontSize,
          fontFamily: textCfg.fontFamily,
          fontStyle: textCfg.fontStyle,
          fill: textCfg.fill,
          align: textCfg.align,
          width: textCfg.width,
          wrap: textCfg.wrap,
          lineHeight: textCfg.lineHeight,
          listening: false
        })
      );
    }

    layer.draw();
    const url = stage.toDataURL({ pixelRatio: 1 });
    stage.destroy();
    container.remove();

    return { url, name: get_image_name(shloka_index, opts.remove_background) };
  }

  // --- Bulk downloads ---
  const download_png_zip = async (remove_back: boolean) => {
    const zip = new JSZip();
    $image_rendering_state = true;
    $zip_download_state = [0, total_count + 2];
    try {
      for (let i = 0; i < total_count; i++) {
        const { url, name } = await export_shloka_to_dataurl(i, {
          remove_background: remove_back
        });
        const blob = dataURLToBlob(url);
        zip.file(name, blob);
        $zip_download_state[0]++;
        $zip_download_state = $zip_download_state;
      }

      const zip_blob = await zip.generateAsync({ type: 'blob' });
      download_file_in_browser(
        URL.createObjectURL(zip_blob),
        `${image_loc} PNG files${remove_back ? '' : ' (with background)'}.zip`
      );
    } finally {
      $image_rendering_state = false;
      $zip_download_state = null;
    }
  };
</script>

{#snippet info_popover(aria_label: string, message: string)}
  <Popover.Root>
    <Popover.Trigger
      type="button"
      class="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-muted-foreground/40"
      aria-label={aria_label}
      onclick={(e) => e.stopPropagation()}
    >
      <Info class="size-3.5" aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Content side="top" class="z-70 w-auto max-w-52 p-2.5 text-pretty" sideOffset={6}>
      <p class="text-xs leading-snug text-muted-foreground">{message}</p>
    </Popover.Content>
  </Popover.Root>
{/snippet}

{#if !$zip_download_state}
  <Popover.Root>
    <Popover.Trigger
      type="button"
      class="inline-flex rounded-lg p-1 text-sm outline-none"
      aria-label="Download images"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span ondblclick={() => download_image_as_png(true)}>
        <Icon src={BsDownload} class="-mt-1 mr-1 text-2xl" />
      </span>
    </Popover.Trigger>
    <Popover.Content
      side="bottom"
      align="end"
      class="z-60 w-auto min-w-64 space-y-2 p-2"
      sideOffset={6}
    >
      <section class="space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 text-xs font-medium">
            <ImageIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            Current image
          </span>
          {@render info_popover(
            'About current image download',
            'Downloads the canvas as shown. Layout, text, and translation match what you see, including moved text.'
          )}
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="xs"
            class="h-auto min-h-7 min-w-0 flex-col gap-1 px-1.5 py-1.5 text-xs whitespace-normal"
            onclick={() => download_image_as_png(true)}
          >
            <ImageOff class="size-3.5 shrink-0" aria-hidden="true" />
            No background
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="h-auto min-h-7 min-w-0 flex-col gap-1 px-1.5 py-1.5 text-xs whitespace-normal"
            onclick={() => download_image_as_png(false)}
          >
            <ImageIcon class="size-3.5 shrink-0" aria-hidden="true" />
            With background
          </Button>
        </div>
      </section>

      <Separator />

      <section class="space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 text-xs font-medium">
            <FileArchive class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            All images (ZIP)
          </span>
          {@render info_popover(
            'About ZIP download',
            'Every image uses original text, translation, and default text positions. Moves and unsaved edits are not included.'
          )}
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="xs"
            class="h-auto min-h-7 min-w-0 flex-col gap-1 px-1.5 py-1.5 text-xs whitespace-normal"
            onclick={() => download_png_zip(true)}
          >
            <ImageOff class="size-3.5 shrink-0" aria-hidden="true" />
            No background
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="h-auto min-h-7 min-w-0 flex-col gap-1 px-1.5 py-1.5 text-xs whitespace-normal"
            onclick={() => download_png_zip(false)}
          >
            <FileImage class="size-3.5 shrink-0" aria-hidden="true" />
            With background
          </Button>
        </div>
      </section>
    </Popover.Content>
  </Popover.Root>
{:else}
  <ProgressRing
    value={($zip_download_state[0] / $zip_download_state[1]) * 100}
    max={100}
    size="size-8"
    strokeWidth="17px"
    meterClass="stroke-primary"
    trackClass="stroke-primary/30"
  />
{/if}
