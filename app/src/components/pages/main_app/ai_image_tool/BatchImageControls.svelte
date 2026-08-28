<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Textarea } from '$lib/components/ui/textarea';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import Plus from '@lucide/svelte/icons/plus';
  import Eye from '@lucide/svelte/icons/eye';
  import Languages from '@lucide/svelte/icons/languages';
  import { client } from '~/api/client';
  import {
    project_state,
    selected_text_levels,
    text_data_present,
    editing_mode
  } from '~/state/main_app/state.svelte';
  import {
    active_text_data_q_options,
    active_trans_en_data_q_options
  } from '~/state/main_app/data.svelte';
  import { invalidate_batch_ai_queries } from '~/state/main_app/batch_query_helpers';
  import {
    IMAGE_BATCH_STATUS_LABELS,
    IMAGE_BATCH_STATUS_VARIANTS
  } from '~/utils/ai_batch/batch_image_status';
  import type {
    available_image_models_schema,
    ai_text_models_type
  } from '~/api/routes/ai/ai_types';
  import type { z } from 'zod';

  type ImageModel = z.infer<typeof available_image_models_schema>;

  type Props = {
    current_index: number;
    /** Edited prompt from the manual UI for the current index */
    current_image_prompt: string;
    image_model: ImageModel;
    text_model: ai_text_models_type;
    /** Shared with AIImageGenerator custom-instruction UI */
    use_custom_instruction?: boolean;
    custom_instruction?: string;
    on_download_images_zip?: () => void;
  };

  let {
    current_index,
    current_image_prompt,
    image_model,
    text_model,
    use_custom_instruction = $bindable(false),
    custom_instruction = $bindable(''),
    on_download_images_zip
  }: Props = $props();

  const effective_custom_instruction = $derived(
    use_custom_instruction && custom_instruction.trim() ? custom_instruction.trim() : undefined
  );

  let single_confirm_open = $state(false);
  let single_auto_approved = $state(true);
  let bulk_open = $state(false);
  let bulk_auto_approved = $state(true);
  let selected_indexes = $state<Set<number>>(new Set());
  let bulk_use_custom_instruction = $state(false);
  let bulk_custom_instruction = $state('');
  let per_shloka_instructions = $state<Record<number, string>>({});
  let per_shloka_draft = $state('');
  let per_shloka_popover_index = $state<number | null>(null);

  const text_data_q = createQuery(() =>
    active_text_data_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );

  const trans_en_data_q = createQuery(() =>
    active_trans_en_data_q_options(
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
      return client.batch_ai_image.get_shloka_image_batch_status.query({
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
      return client.batch_ai_image.get_shloka_image_batch_status.query({
        project_id: $project_state.project_id,
        selected_text_levels: $selected_text_levels
      });
    },
    enabled: !!$project_state,
    staleTime: 30_000
  }));

  type TriggerItem = {
    index: number;
    image_prompt?: string;
    custom_instruction?: string;
  };

  const trigger_mut = createMutation(() => ({
    mutationFn: (args: { auto_approved: boolean; items: TriggerItem[] }) =>
      client.batch_ai_image.trigger_batch_shloka_image_gen.mutate({
        auto_approved: args.auto_approved,
        project_id: $project_state!.project_id,
        project_key: $project_state!.project_key,
        selected_text_levels: $selected_text_levels,
        image_model,
        text_model,
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
    bulk_use_custom_instruction = false;
    bulk_custom_instruction = '';
    per_shloka_instructions = {};
    per_shloka_popover_index = null;
    per_shloka_draft = '';
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

  const resolve_bulk_custom_instruction = (index: number): string | undefined => {
    const per = per_shloka_instructions[index]?.trim();
    if (per) return per;
    if (bulk_use_custom_instruction && bulk_custom_instruction.trim()) {
      return bulk_custom_instruction.trim();
    }
    return undefined;
  };

  const open_per_shloka_popover = (index: number) => {
    per_shloka_draft = per_shloka_instructions[index] ?? '';
    per_shloka_popover_index = index;
  };

  const save_per_shloka_instruction = (index: number) => {
    const trimmed = per_shloka_draft.trim();
    const next = { ...per_shloka_instructions };
    if (trimmed) next[index] = trimmed;
    else delete next[index];
    per_shloka_instructions = next;
    per_shloka_popover_index = null;
    per_shloka_draft = '';
  };

  const build_bulk_items = (): TriggerItem[] =>
    [...selected_indexes]
      .sort((a, b) => a - b)
      .map((index) => {
        const item: TriggerItem = { index };
        const custom = resolve_bulk_custom_instruction(index);
        if (custom) item.custom_instruction = custom;
        return item;
      });
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
      variant="outline"
      class="border-cyan-800/70 bg-cyan-100 font-semibold text-cyan-950 hover:bg-cyan-200 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900 dark:hover:text-cyan-200"
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
      class="soft-pulse bg-violet-600 font-semibold text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400"
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
    <div class="space-y-1.5">
      <label class="flex items-center gap-2 text-sm font-semibold">
        <Checkbox bind:checked={use_custom_instruction} />
        Custom Image Gen Instruction
      </label>
      {#if use_custom_instruction}
        <Textarea
          class="h-14 min-h-0 resize-none px-2 py-1.5 text-sm"
          rows={2}
          spellcheck="false"
          placeholder="Optional guidance for the image prompt…"
          bind:value={custom_instruction}
        />
      {/if}
    </div>
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
                  : effective_custom_instruction
                    ? { custom_instruction: effective_custom_instruction }
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
            items: build_bulk_items()
          })}
      >
        {trigger_mut.isPending ? 'Queuing…' : 'Generate Images'}
      </Button>
    </Dialog.Header>

    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={bulk_auto_approved} />
      Auto-approve when complete
    </label>

    <div class="space-y-1.5">
      <label class="flex items-center gap-2 text-sm font-semibold">
        <Checkbox bind:checked={bulk_use_custom_instruction} />
        Common Custom Image Gen Instruction
      </label>
      {#if bulk_use_custom_instruction}
        <Textarea
          class="h-14 min-h-0 resize-none px-2 py-1.5 text-sm"
          rows={2}
          spellcheck="false"
          placeholder="Applied to all selected shlokas (unless overridden)…"
          bind:value={bulk_custom_instruction}
        />
      {/if}
    </div>

    <p class="text-xs text-muted-foreground/80">
      Edit a custom instruction for individual images by clicking the + button on selected shlokas.
    </p>

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
        <Tooltip.Provider>
          {#each bulk_rows as row (row.index)}
            {@const is_selected = selected_indexes.has(row.index)}
            {@const per_instruction = per_shloka_instructions[row.index]?.trim()}
            {@const en_translation = trans_en_data_q.data?.get(row.index)?.trim()}
            <div class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
              <label class="flex shrink-0 cursor-pointer items-center gap-3">
                <Checkbox
                  checked={is_selected}
                  onCheckedChange={(checked) => toggle_index(row.index, checked === true)}
                />
                <span class="text-sm font-medium">
                  {row.index}{row.shloka_num != null ? ` - ${row.shloka_num}` : ''}
                </span>
              </label>
              <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {row.text.slice(0, 60)}
              </span>
              <div class="flex shrink-0 items-center gap-0.5">
                <Popover.Root>
                  <Popover.Trigger
                    type="button"
                    class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="View full shloka text for index {row.index}"
                    title="View shloka"
                  >
                    <Eye class="size-3.5" />
                  </Popover.Trigger>
                  <Popover.Content class="w-80 max-w-[min(20rem,85vw)] space-y-1.5 p-3" align="end">
                    <p class="text-xs font-medium text-muted-foreground">Shloka</p>
                    <p class="text-sm leading-relaxed whitespace-pre-wrap">{row.text}</p>
                  </Popover.Content>
                </Popover.Root>
                <div class="size-6 shrink-0">
                  {#if en_translation}
                    <Popover.Root>
                      <Popover.Trigger
                        type="button"
                        class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="View English translation for index {row.index}"
                        title="View English translation"
                      >
                        <Languages class="size-3.5" />
                      </Popover.Trigger>
                      <Popover.Content
                        class="w-80 max-w-[min(20rem,85vw)] space-y-1.5 p-3"
                        align="end"
                      >
                        <p class="text-xs font-medium text-muted-foreground">English</p>
                        <p class="text-sm leading-relaxed whitespace-pre-wrap">{en_translation}</p>
                      </Popover.Content>
                    </Popover.Root>
                  {/if}
                </div>
                <div class="relative size-6 shrink-0">
                  {#if is_selected}
                    <Popover.Root
                      open={per_shloka_popover_index === row.index}
                      onOpenChange={(open) => {
                        if (open) open_per_shloka_popover(row.index);
                        else if (per_shloka_popover_index === row.index) {
                          per_shloka_popover_index = null;
                          per_shloka_draft = '';
                        }
                      }}
                    >
                      <Popover.Trigger
                        type="button"
                        class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Custom instruction for index {row.index}"
                      >
                        <Plus class="size-3.5" />
                      </Popover.Trigger>
                      <Popover.Content class="w-72 space-y-2 p-3" align="end">
                        <p class="text-xs font-medium">Custom instruction</p>
                        <Textarea
                          class="h-20 min-h-0 resize-none px-2 py-1.5 text-sm"
                          rows={3}
                          spellcheck="false"
                          placeholder="Overrides the common custom instruction…"
                          bind:value={per_shloka_draft}
                        />
                        <div class="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onclick={() => {
                              per_shloka_popover_index = null;
                              per_shloka_draft = '';
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onclick={() => save_per_shloka_instruction(row.index)}>
                            Done
                          </Button>
                        </div>
                      </Popover.Content>
                    </Popover.Root>
                    {#if per_instruction}
                      <Tooltip.Root>
                        <Tooltip.Trigger
                          type="button"
                          class="absolute -top-0.5 -right-0.5 z-10 inline-flex size-3 items-center justify-center"
                          aria-label="View custom instruction"
                        >
                          <span class="size-1.5 rounded-full bg-violet-500" aria-hidden="true"
                          ></span>
                        </Tooltip.Trigger>
                        <Tooltip.Content
                          side="left"
                          showArrow={false}
                          class="max-w-xs border border-border bg-popover p-2 text-popover-foreground shadow-md"
                        >
                          <p class="text-xs whitespace-pre-wrap">{per_instruction}</p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </Tooltip.Provider>
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

<style>
  @keyframes soft-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.78;
    }
  }

  :global(.soft-pulse) {
    animation: soft-pulse 2.8s ease-in-out infinite;
  }
</style>
