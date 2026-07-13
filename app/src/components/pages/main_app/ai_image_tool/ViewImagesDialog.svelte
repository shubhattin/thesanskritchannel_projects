<script lang="ts">
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Select from '$lib/components/ui/select';
  import * as Pagination from '$lib/components/ui/pagination';
  import { Button } from '$lib/components/ui/button';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { client } from '~/api/client';
  import {
    project_state,
    selected_text_levels,
    text_data_present,
    editing_mode
  } from '~/state/main_app/state.svelte';
  import { active_text_data_q_options } from '~/state/main_app/data.svelte';
  import {
    invalidate_text_image_queries,
    text_images_query_key
  } from '~/state/main_app/batch_query_helpers';
  import TextImageCard from './TextImageCard.svelte';
  import { buildImageAssetDownloadBasename } from '~/tools/download_file_browser';

  type Props = {
    open?: boolean;
    /** Prefer focusing this index in Shloka Specific tab */
    focus_index?: number;
  };

  let { open = $bindable(false), focus_index = 0 }: Props = $props();

  const PAGE_SIZE = 8;

  let tab = $state<'all_images' | 'shloka_specific'>('all_images');
  let selected_index = $state(0);
  let deleting_id = $state<number | null>(null);
  let page = $state(1);

  $effect(() => {
    if (open) {
      tab = 'all_images';
      selected_index = focus_index;
      page = 1;
    }
  });

  $effect(() => {
    tab;
    selected_index;
    page = 1;
  });

  const text_data_q = createQuery(() =>
    active_text_data_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );

  const images_q = createQuery(() => ({
    queryKey: text_images_query_key(
      $project_state,
      $selected_text_levels,
      tab === 'shloka_specific' ? selected_index : undefined
    ),
    queryFn: async () => {
      if (!$project_state) return [];
      return client.ai.image_assets.list.query({
        project_id: $project_state.project_id,
        selected_text_levels: $selected_text_levels,
        ...(tab === 'shloka_specific' ? { index: selected_index } : {})
      });
    },
    enabled: open && !!$project_state
  }));

  const all_images = $derived(images_q.data ?? []);
  const total_count = $derived(all_images.length);
  const paged_images = $derived(all_images.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

  $effect(() => {
    const max_page = Math.max(1, Math.ceil(total_count / PAGE_SIZE) || 1);
    if (page > max_page) page = max_page;
  });

  const delete_mut = createMutation(() => ({
    mutationFn: (image_asset_id: number) =>
      client.ai.image_assets.delete.mutate({ image_asset_id }),
    onSuccess: async () => {
      await invalidate_text_image_queries($project_state?.project_id);
      toast.success('Image deleted from gallery and storage');
    },
    onError: (err) => toast.error(err.message || 'Failed to delete image'),
    onSettled: () => {
      deleting_id = null;
    }
  }));

  const label_for = (index: number | null, shloka_num: number | null) => {
    if (index === null) return 'orphan';
    return shloka_num != null ? `${index}:${shloka_num}` : `${index}`;
  };

  const download_basename_for = (index: number | null, shloka_num: number | null) =>
    buildImageAssetDownloadBasename(index, shloka_num);
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[92vh] w-[min(96vw,72rem)] flex-col gap-4 sm:max-w-6xl">
    <Dialog.Header>
      <Dialog.Title>View Images</Dialog.Title>
      <Dialog.Description>
        Browse generated images for this project path. Orphan images belong to the path but no
        longer to a specific index.
      </Dialog.Description>
    </Dialog.Header>

    <Tabs.Root bind:value={tab} class="flex min-h-0 flex-1 flex-col gap-3">
      <Tabs.List>
        <Tabs.Trigger value="all_images">All Images</Tabs.Trigger>
        <Tabs.Trigger value="shloka_specific">Shloka Specific</Tabs.Trigger>
      </Tabs.List>

      {#if tab === 'shloka_specific'}
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">Index</span>
          <Select.Root
            type="single"
            value={String(selected_index)}
            onValueChange={(v) => {
              selected_index = Number(v) || 0;
            }}
          >
            <Select.Trigger class="w-40">
              {#if text_data_q.data?.[selected_index]}
                {selected_index}{text_data_q.data[selected_index].shloka_num != null
                  ? ` - ${text_data_q.data[selected_index].shloka_num}`
                  : ''}
              {:else}
                {selected_index}
              {/if}
            </Select.Trigger>
            <Select.Content>
              {#each text_data_q.data ?? [] as row (row.index)}
                <Select.Item value={String(row.index)}>
                  {row.index}{row.shloka_num != null ? ` - ${row.shloka_num}` : ''}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}

      <ScrollArea class="h-[min(70vh,36rem)] rounded-md border p-3">
        {#if images_q.isLoading}
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {#each Array(PAGE_SIZE) as _}
              <Skeleton class="aspect-square w-full rounded-md" />
            {/each}
          </div>
        {:else if images_q.isError}
          <div class="py-10 text-center text-sm text-destructive">
            Failed to load images. {images_q.error.message}
          </div>
        {:else if total_count === 0}
          <div class="py-10 text-center text-sm text-muted-foreground">No images yet.</div>
        {:else}
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {#each paged_images as item (item.image.id)}
              <TextImageCard
                url={item.image.url}
                s3_key={item.image.s3_key}
                alt={item.image.description ?? label_for(item.index, item.shloka_num)}
                width={item.image.width}
                height={item.image.height}
                label={label_for(item.index, item.shloka_num)}
                download_basename={download_basename_for(item.index, item.shloka_num)}
                deleting={deleting_id === item.image.id}
                on_delete={async () => {
                  deleting_id = item.image.id;
                  await delete_mut.mutateAsync(item.image.id);
                }}
              />
            {/each}
          </div>
        {/if}
      </ScrollArea>

      {#if total_count > PAGE_SIZE}
        <Pagination.Root count={total_count} perPage={PAGE_SIZE} bind:page>
          {#snippet children({ pages, currentPage })}
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous />
              </Pagination.Item>
              {#each pages as pageItem (pageItem.key)}
                {#if pageItem.type === 'ellipsis'}
                  <Pagination.Item>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                {:else}
                  <Pagination.Item>
                    <Pagination.Link page={pageItem} isActive={currentPage === pageItem.value}>
                      {pageItem.value}
                    </Pagination.Link>
                  </Pagination.Item>
                {/if}
              {/each}
              <Pagination.Item>
                <Pagination.Next />
              </Pagination.Item>
            </Pagination.Content>
          {/snippet}
        </Pagination.Root>
      {/if}
    </Tabs.Root>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Close</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
