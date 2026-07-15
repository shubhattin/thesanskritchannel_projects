<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { client } from '~/api/client';
  import {
    project_state,
    selected_text_levels,
    text_data_present,
    editing_mode
  } from '~/state/main_app/state.svelte';
  import { active_text_data_q_options } from '~/state/main_app/data.svelte';
  import { invalidate_batch_ai_queries } from '~/state/main_app/batch_query_helpers';
  import {
    IMAGE_BATCH_STATUS_LABELS,
    IMAGE_BATCH_STATUS_VARIANTS
  } from '~/utils/ai_batch/batch_image_status';
  import type { available_image_models_schema } from '~/api/routes/ai/ai_types';
  import type { z } from 'zod';

  type ImageModel = z.infer<typeof available_image_models_schema>;

  type Props = {
    current_index: number;
    /** Edited prompt from the manual UI for the current index */
    current_image_prompt: string;
    image_model: ImageModel;
    on_download_images_zip?: () => void;
  };

  let { current_index, current_image_prompt, image_model, on_download_images_zip }: Props =
    $props();

  let single_confirm_open = $state(false);
  let single_auto_approved = $state(true);
  let bulk_open = $state(false);
  let bulk_auto_approved = $state(true);
  let selected_indexes = $state<Set<number>>(new Set());

  const text_data_q = createQuery(() =>
    active_text_data_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );

  const index_status_q = createQuery(() => ({
    queryKey: [
      'shloka_batch_status',
      $project_state?.project_id ?? null,
      'index',
      current_index,
      $selected_text_levels
    ],
    queryFn: async () => {
      if (!$project_state) return null;
      return client.batch_ai.get_shloka_image_batch_status.query({
        project_id: $project_state.project_id,
        selected_text_levels: $selected_text_levels,
        index: current_index
      });
    },
    enabled: !!$project_state,
    staleTime: 30_000
  }));

  const path_status_q = createQuery(() => ({
    queryKey: [
      'shloka_batch_status',
      $project_state?.project_id ?? null,
      'path',
      $selected_text_levels
    ],
    queryFn: async () => {
      if (!$project_state) return null;
      return client.batch_ai.get_shloka_image_batch_status.query({
        project_id: $project_state.project_id,
        selected_text_levels: $selected_text_levels
      });
    },
    enabled: !!$project_state,
    staleTime: 30_000
  }));

  const trigger_mut = createMutation(() => ({
    mutationFn: (args: {
      auto_approved: boolean;
      items: { index: number; image_prompt?: string }[];
    }) =>
      client.batch_ai.trigger_batch_shloka_image_gen.mutate({
        auto_approved: args.auto_approved,
        project_id: $project_state!.project_id,
        project_key: $project_state!.project_key,
        selected_text_levels: $selected_text_levels,
        image_model,
        items: args.items
      }),
    onSuccess: async (data) => {
      await invalidate_batch_ai_queries({ project_id: $project_state?.project_id });
      toast.success(`Batch ${data.batch_id} queued (${data.item_count} image(s))`);
      single_confirm_open = false;
      bulk_open = false;
    },
    onError: (err) => toast.error(err.message || 'Failed to trigger batch')
  }));

  const open_bulk = () => {
    const defaults = new Set<number>();
    for (const row of text_data_q.data ?? []) {
      if (row.shloka_num != null) defaults.add(row.index);
    }
    selected_indexes = defaults;
    bulk_auto_approved = true;
    bulk_open = true;
  };

  const toggle_index = (index: number, checked: boolean) => {
    const next = new Set(untrack(() => selected_indexes));
    if (checked) next.add(index);
    else next.delete(index);
    selected_indexes = next;
  };

  const bulk_rows = $derived(text_data_q.data ?? []);
  const all_selected = $derived(
    bulk_rows.length > 0 && bulk_rows.every((row) => selected_indexes.has(row.index))
  );
  const some_selected = $derived(
    bulk_rows.some((row) => selected_indexes.has(row.index)) && !all_selected
  );

  const toggle_all = (checked: boolean) => {
    if (checked) {
      selected_indexes = new Set(bulk_rows.map((row) => row.index));
      return;
    }
    selected_indexes = new Set();
  };
</script>

<section class="space-y-3 rounded-lg border border-border/80 bg-card/40 p-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3 class="text-sm font-semibold tracking-wide">Batch Image Generation</h3>
    <a
      href="/batch-manager"
      class="text-xs font-medium text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      Open Batch Manager
    </a>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <Button
      size="sm"
      disabled={trigger_mut.isPending}
      onclick={() => {
        single_auto_approved = true;
        single_confirm_open = true;
      }}
    >
      Generate Shloka Image
    </Button>
    <Button
      size="sm"
      variant="secondary"
      class="animate-pulse bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500"
      disabled={trigger_mut.isPending}
      onclick={open_bulk}
    >
      Generate Images for All Shlokas
    </Button>
    {#if on_download_images_zip}
      <Button
        size="sm"
        variant="outline"
        class="border-violet-500/50 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
        onclick={on_download_images_zip}
      >
        Download Images Zip
      </Button>
    {/if}
  </div>

  {#if index_status_q.data}
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-muted-foreground">Current shloka:</span>
      <Badge variant={IMAGE_BATCH_STATUS_VARIANTS[index_status_q.data.status]}>
        {IMAGE_BATCH_STATUS_LABELS[index_status_q.data.status]}
      </Badge>
      <a class="text-primary hover:underline" href="/batch-manager">Batch Manager</a>
    </div>
  {/if}
  {#if path_status_q.data && path_status_q.data.custom_id !== index_status_q.data?.custom_id}
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-muted-foreground">Path batch:</span>
      <Badge variant={IMAGE_BATCH_STATUS_VARIANTS[path_status_q.data.status]}>
        {IMAGE_BATCH_STATUS_LABELS[path_status_q.data.status]}
      </Badge>
    </div>
  {/if}
</section>

<AlertDialog.Root bind:open={single_confirm_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Generate batch image for this shloka?</AlertDialog.Title>
      <AlertDialog.Description>
        Queues a cheaper background OpenAI batch job for index {current_index}.
        {#if current_image_prompt.trim()}
          The edited Image Prompt will be used.
        {:else}
          An image prompt will be generated first.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={single_auto_approved} />
      Auto-approve when complete
    </label>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={trigger_mut.isPending}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={trigger_mut.isPending}
        onclick={() =>
          trigger_mut.mutate({
            auto_approved: single_auto_approved,
            items: [
              {
                index: current_index,
                ...(current_image_prompt.trim()
                  ? { image_prompt: current_image_prompt.trim() }
                  : {})
              }
            ]
          })}
      >
        {trigger_mut.isPending ? 'Queuing…' : 'Generate'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={bulk_open}>
  <Dialog.Content class="flex max-h-[90vh] w-[min(96vw,42rem)] flex-col gap-4 sm:max-w-xl">
    <Dialog.Header class="flex-row items-start justify-between gap-3 space-y-0">
      <div class="space-y-1.5">
        <Dialog.Title>Generate Images for All Shlokas</Dialog.Title>
        <Dialog.Description>
          Only checked indexes are submitted. Rows with a shloka number are selected by default.
        </Dialog.Description>
      </div>
      <Button
        size="sm"
        disabled={trigger_mut.isPending || selected_indexes.size === 0}
        onclick={() =>
          trigger_mut.mutate({
            auto_approved: bulk_auto_approved,
            items: [...selected_indexes].sort((a, b) => a - b).map((index) => ({ index }))
          })}
      >
        {trigger_mut.isPending ? 'Queuing…' : 'Generate Images'}
      </Button>
    </Dialog.Header>

    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={bulk_auto_approved} />
      Auto-approve when complete
    </label>

    <ScrollArea class="h-[min(50vh,24rem)] rounded-md border p-2">
      <div class="flex flex-col gap-1">
        <label
          class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
        >
          <Checkbox
            checked={all_selected}
            indeterminate={some_selected}
            onCheckedChange={(checked) => toggle_all(checked === true)}
          />
          <span class="text-sm font-medium">
            Select all
            {#if bulk_rows.length > 0}
              <span class="font-normal text-muted-foreground">
                ({selected_indexes.size}/{bulk_rows.length})
              </span>
            {/if}
          </span>
        </label>
        <Separator class="my-1" />
        {#each bulk_rows as row (row.index)}
          <label
            class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
          >
            <Checkbox
              checked={selected_indexes.has(row.index)}
              onCheckedChange={(checked) => toggle_index(row.index, checked === true)}
            />
            <span class="text-sm font-medium">
              {row.index}{row.shloka_num != null ? ` - ${row.shloka_num}` : ''}
            </span>
            <span class="truncate text-xs text-muted-foreground">{row.text.slice(0, 60)}</span>
          </label>
        {/each}
      </div>
    </ScrollArea>

    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => (bulk_open = false)}
        disabled={trigger_mut.isPending}
      >
        Cancel
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
