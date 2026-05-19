<script lang="ts">
  import { get_total_count, project_map_q } from '~/state/main_app/data.svelte';
  import Konva from 'konva';
  import {
    image_selected_levels,
    image_script,
    image_shloka,
    shaded_background_image_status,
    BACKGROUND_IMAGE_URLS,
    IMAGE_DIMENSIONS,
    image_lang,
    image_rendering_state,
    zip_download_state
  } from './image_state';
  import { download_file_in_browser } from '~/tools/download_file_browser';
  import JSZip from 'jszip';
  import { dataURLToBlob } from '~/tools/kry';
  import { BsDownload } from 'svelte-icons-pack/bs';
  import Icon from '~/tools/Icon.svelte';
  import { compute_all_layouts } from './render_text';
  import * as Popover from '$lib/components/ui/popover';
  import { ProgressRing } from '$lib/components/ui/progress-ring';
  import { project_state } from '~/state/main_app/state.svelte';
  import { get_path_params } from '~/state/project_list';

  let total_count = $derived(
    $project_map_q.isSuccess ? get_total_count($image_selected_levels) : 0
  );
  let image_loc = $derived(
    get_path_params($image_selected_levels, $project_state.levels!).join('.')
  );

  // --- Helper: load an image as HTMLImageElement ---
  function load_image(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // --- Export a single shloka to an offscreen Konva stage ---
  async function export_shloka_to_dataurl(
    shloka_index: number,
    opts: { remove_background: boolean }
  ): Promise<{ url: string; name: string }> {
    const layout = await compute_all_layouts(shloka_index, $image_script, $image_lang);
    if (!layout) throw new Error(`Failed to compute layout for shloka ${shloka_index}`);

    // Create offscreen stage at full resolution
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

    // Background
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

    // Text elements
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
          listening: false
        })
      );
    }

    // No bounding/reference lines in exports (same as original — lines are hidden before export)

    layer.draw();
    const url = stage.toDataURL({ pixelRatio: 1 });

    // Cleanup
    stage.destroy();
    container.remove();

    const name =
      (image_loc !== '' ? `${image_loc} ` : '') +
      `Index No. ${shloka_index}${opts.remove_background ? '' : ' (with background)'}.png`;

    return { url, name };
  }

  const download_image_as_png = async (remove_background: boolean) => {
    const { url, name } = await export_shloka_to_dataurl($image_shloka, { remove_background });
    download_file_in_browser(url, name);
  };

  // --- Bulk downloads ---
  const download_png_zip = async (remove_back: boolean) => {
    const zip = new JSZip();
    $image_rendering_state = true;
    $zip_download_state = [0, total_count + 2];
    for (let i = 0; i < total_count; i++) {
      const { url, name } = await export_shloka_to_dataurl(i, {
        remove_background: remove_back
      });
      const blob = dataURLToBlob(url);
      zip.file(name, blob);
      $zip_download_state[0]++;
      $zip_download_state = $zip_download_state;
    }
    $image_rendering_state = false;
    const zip_blob = await zip.generateAsync({ type: 'blob' });
    download_file_in_browser(
      URL.createObjectURL(zip_blob),
      `${image_loc} PNG files${remove_back ? '' : ' (with background)'}.zip`
    );
    $zip_download_state = null;
  };
</script>

{#if !$zip_download_state}
  <Popover.Root>
    <Popover.Trigger class="inline-flex rounded-lg p-1 text-sm">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span ondblclick={() => download_image_as_png(true)}>
        <Icon src={BsDownload} class="-mt-1 mr-1 text-2xl" />
      </span>
    </Popover.Trigger>
    <Popover.Content side="bottom" class="w-auto space-y-0 p-1">
      <div class="flex items-center justify-center space-x-2">
        <button
          onclick={() => download_image_as_png(true)}
          class="rounded-md p-1 text-sm hover:bg-muted"
        >
          PNG
        </button>
        <button
          onclick={() => download_image_as_png(false)}
          class="rounded-md p-1 text-xs hover:bg-muted"
        >
          PNG (with background)
        </button>
      </div>
      <div class="flex items-center justify-center space-x-2">
        <button
          onclick={() => download_png_zip(true)}
          class="rounded-md p-1 text-sm hover:bg-muted"
        >
          PNG Zip
        </button>
        <button
          onclick={() => download_png_zip(false)}
          class="rounded-md p-1 text-xs hover:bg-muted"
        >
          PNG Zip (with background)
        </button>
      </div>
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
