<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Carousel from '$lib/components/ui/carousel';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { client } from '~/api/client';
  import {
    project_state,
    selected_text_levels,
    text_data_present,
    editing_mode
  } from '~/state/main_app/state.svelte';
  import { active_text_data_q_options } from '~/state/main_app/data.svelte';
  import { text_images_query_key } from '~/state/main_app/batch_query_helpers';
  import { get_path_params } from '~/state/project_list';
  import {
    buildImageAssetDownloadBasename,
    download_file_in_browser
  } from '~/tools/download_file_browser';
  import { fetch_post } from '~/tools/fetch';
  import {
    buildAiImagesZipFileName,
    uniquifyZipFilenames,
    type DownloadImagesZipFormat
  } from '~/utils/image_assets/download_images_zip';

  type Props = {
    open?: boolean;
  };

  let { open = $bindable(false) }: Props = $props();

  type ImageListItem = Awaited<ReturnType<typeof client.ai.image_assets.list.query>>[number];

  type IndexGroup = {
    key: string;
    index: number | null;
    shloka_num: number | null;
    label: string;
    images: ImageListItem[];
  };

  let selected_ids = $state<Set<number>>(new Set());
  let processing = $state(false);
  let selection_seeded = $state(false);
  let format = $state<DownloadImagesZipFormat>('png');

  const text_data_q = createQuery(() =>
    active_text_data_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );

  const images_q = createQuery(() => ({
    queryKey: text_images_query_key($project_state, $selected_text_levels, undefined),
    queryFn: async () => {
      if (!$project_state) return [];
      return client.ai.image_assets.list.query({
        project_id: $project_state.project_id,
        selected_text_levels: $selected_text_levels
      });
    },
    enabled: open && !!$project_state
  }));

  const label_for = (index: number | null, shloka_num: number | null) => {
    if (index === null) return 'orphan';
    return shloka_num != null ? `${index}:${shloka_num}` : `${index}`;
  };

  const groups = $derived.by((): IndexGroup[] => {
    const items = images_q.data ?? [];
    const map = new Map<string, IndexGroup>();
    for (const item of items) {
      const key = item.index === null ? 'orphan' : String(item.index);
      let group = map.get(key);
      if (!group) {
        const shloka_num =
          item.shloka_num ??
          (item.index != null ? (text_data_q.data?.[item.index]?.shloka_num ?? null) : null);
        group = {
          key,
          index: item.index,
          shloka_num,
          label: label_for(item.index, shloka_num),
          images: []
        };
        map.set(key, group);
      }
      group.images.push(item);
    }
    return [...map.values()].sort((a, b) => {
      if (a.index === null) return 1;
      if (b.index === null) return -1;
      return a.index - b.index;
    });
  });

  const selected_count = $derived(selected_ids.size);

  const path_params = $derived(
    $project_state ? get_path_params($selected_text_levels, $project_state.levels) : []
  );

  const zip_file_name = $derived(
    $project_state ? buildAiImagesZipFileName($project_state.project_key, path_params) : ''
  );

  /** Seed default selection once per open (first image per index group). */
  $effect(() => {
    if (!open) {
      processing = false;
      selection_seeded = false;
      return;
    }
    if (selection_seeded || !images_q.data) return;
    format = 'png';
    const next = new Set<number>();
    const seen_indexes = new Set<string>();
    for (const item of images_q.data) {
      const key = item.index === null ? 'orphan' : String(item.index);
      if (seen_indexes.has(key)) continue;
      seen_indexes.add(key);
      next.add(item.image.id);
    }
    selected_ids = next;
    selection_seeded = true;
  });

  const toggle_image = (image_id: number, checked: boolean) => {
    const next = new Set(selected_ids);
    if (checked) next.add(image_id);
    else next.delete(image_id);
    selected_ids = next;
  };

  const download_zip = async () => {
    if (!$project_state || selected_count === 0 || processing) return;
    processing = true;
    try {
      const selected_items = (images_q.data ?? []).filter((item) =>
        selected_ids.has(item.image.id)
      );
      const files = uniquifyZipFilenames(
        selected_items.map((item) => ({
          image_id: item.image.id,
          filename: buildImageAssetDownloadBasename(item.index, item.shloka_num)
        })),
        format
      );

      const req = await fetch_post('/api/download_images_zip', {
        json: {
          zip_file_name,
          project_id: $project_state.project_id,
          path_params,
          format,
          files
        }
      });

      if (!req.ok) {
        const message = (await req.text().catch(() => '')) || 'Failed to create zip';
        throw new Error(message);
      }

      const blob = await req.blob();
      const blob_url = URL.createObjectURL(blob);
      download_file_in_browser(blob_url, zip_file_name, true);
      toast.success('Images zip downloaded');
      open = false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download images zip');
    } finally {
      processing = false;
    }
  };
</script>

<Dialog.Root
  {open}
  onOpenChange={(next) => {
    if (processing && !next) return;
    open = next;
  }}
>
  <Dialog.Content
    class="flex max-h-[92vh] w-[min(96vw,72rem)] flex-col gap-4 sm:max-w-6xl"
    showCloseButton={!processing}
    interactOutsideBehavior={processing ? 'ignore' : 'close'}
    escapeKeydownBehavior={processing ? 'ignore' : 'close'}
  >
    {#if processing}
      <Dialog.Header>
        <Dialog.Title>Preparing Zip</Dialog.Title>
        <Dialog.Description>
          Building the archive on the server. Please wait — this can take a while for many images.
        </Dialog.Description>
      </Dialog.Header>
      <div class="flex flex-col items-center justify-center gap-4 py-16">
        <LoaderCircle class="size-12 animate-spin text-violet-600" />
        <p class="text-sm text-muted-foreground">Generating zip file…</p>
        <p class="max-w-md text-center text-xs text-muted-foreground">{zip_file_name}</p>
      </div>
    {:else}
      <Dialog.Header>
        <Dialog.Title>Download Images Zip</Dialog.Title>
        <Dialog.Description>
          Images are grouped by index. Only the first image in each group is selected by default.
          Orphan images (no index) are included when present.
        </Dialog.Description>
      </Dialog.Header>

      <fieldset class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend class="text-sm font-medium">Format</legend>
        <RadioGroup.Root bind:value={format} class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div class="flex items-center gap-1.5">
            <RadioGroup.Item value="png" id="download-zip-format-png" />
            <Label for="download-zip-format-png" class="cursor-pointer text-sm font-normal"
              >PNG</Label
            >
          </div>
          <div class="flex items-center gap-1.5">
            <RadioGroup.Item value="webp" id="download-zip-format-webp" />
            <Label for="download-zip-format-webp" class="cursor-pointer text-sm font-normal"
              >WebP</Label
            >
          </div>
        </RadioGroup.Root>
      </fieldset>

      <ScrollArea class="h-[min(70vh,40rem)] rounded-md border p-3">
        {#if images_q.isLoading}
          <div class="space-y-4">
            {#each Array(3) as _, i (i)}
              <Skeleton class="h-48 w-full rounded-md" />
            {/each}
          </div>
        {:else if images_q.isError}
          <div class="py-10 text-center text-sm text-destructive">
            Failed to load images. {images_q.error.message}
          </div>
        {:else if groups.length === 0}
          <div class="py-10 text-center text-sm text-muted-foreground">No images yet.</div>
        {:else}
          <div class="flex flex-col gap-5">
            {#each groups as group (group.key)}
              <section class="rounded-lg border border-border bg-card/40 p-3">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold">{group.label}</h3>
                  <span class="text-xs text-muted-foreground">{group.images.length} image(s)</span>
                </div>
                <Carousel.Root opts={{ align: 'start', loop: false }} class="w-full">
                  <Carousel.Content class="-ms-2">
                    {#each group.images as item (item.image.id)}
                      {@const checked = selected_ids.has(item.image.id)}
                      <Carousel.Item class="basis-1/2 ps-2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5">
                        <div class="flex flex-col gap-1">
                          <label
                            class="relative aspect-square cursor-pointer overflow-hidden rounded-md border border-border bg-muted/20"
                          >
                            <img
                              src={item.image.url}
                              alt={item.image.description ?? group.label}
                              class="size-full object-cover"
                              loading="lazy"
                            />
                            <div
                              class="absolute top-1.5 left-1.5 rounded-md bg-background/85 p-0.5 shadow-sm backdrop-blur-sm"
                            >
                              <Checkbox
                                {checked}
                                onCheckedChange={(v) => toggle_image(item.image.id, v === true)}
                              />
                            </div>
                          </label>
                          <span class="truncate text-[11px] text-muted-foreground">
                            {item.image.width}×{item.image.height}
                          </span>
                        </div>
                      </Carousel.Item>
                    {/each}
                  </Carousel.Content>
                  {#if group.images.length > 2}
                    <Carousel.Previous class="-left-3" />
                    <Carousel.Next class="-right-3" />
                  {/if}
                </Carousel.Root>
              </section>
            {/each}
          </div>
        {/if}
      </ScrollArea>

      <Dialog.Footer class="flex-wrap gap-2 sm:justify-between">
        <span class="text-xs text-muted-foreground">
          {selected_count} selected · {format.toUpperCase()} · {zip_file_name}
        </span>
        <div class="flex gap-2">
          <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
          <Button
            class="bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500"
            disabled={selected_count === 0 || !$project_state}
            onclick={() => void download_zip()}
          >
            Download Zip
          </Button>
        </div>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
