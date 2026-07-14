<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Separator } from '$lib/components/ui/separator';
  import Label from '$lib/components/ui/label/label.svelte';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { client } from '~/api/client';
  import {
    editing_mode,
    get_active_translation_slot,
    project_state,
    selected_text_levels,
    selected_translation_lang_ids
  } from '~/state/main_app/state.svelte';
  import { invalidate_batch_ai_queries } from '~/state/main_app/batch_query_helpers';
  import { lang_list_obj } from '~/state/lang_list';
  import { AIIcon } from '~/components/icons';
  import Icon from '~/tools/Icon.svelte';

  type Props = {
    /** Level name shown in the dialog (e.g. Sarga) */
    level_name: string;
  };

  let { level_name }: Props = $props();

  let dialog_open = $state(false);
  let auto_approved = $state(true);
  let include_english_context = $state(false);
  let overwrite_confirmed = $state<'yes' | 'no'>('no');
  let selected_values = $state<Set<number>>(new Set());

  const active_translation_slot = $derived(get_active_translation_slot($editing_mode));
  const active_lang_id = $derived(
    active_translation_slot === null
      ? null
      : $selected_translation_lang_ids[active_translation_slot]
  );
  const is_non_english = $derived(
    active_lang_id !== null && active_lang_id !== lang_list_obj.English
  );

  const targets_q = createQuery(() => ({
    queryKey: [
      'batch_translation_targets',
      $project_state?.project_id ?? null,
      active_lang_id,
      $selected_text_levels
    ],
    queryFn: async () => {
      if (!$project_state || active_lang_id === null) return null;
      return client.batch_ai.list_batch_translation_targets.query({
        project_id: $project_state.project_id,
        lang_id: active_lang_id,
        selected_text_levels: $selected_text_levels
      });
    },
    enabled: dialog_open && !!$project_state && active_lang_id !== null,
    staleTime: 30_000
  }));

  const leaves = $derived(targets_q.data?.leaves ?? []);
  const all_selected = $derived(
    leaves.length > 0 && leaves.every((leaf) => selected_values.has(leaf.value))
  );
  const some_selected = $derived(
    leaves.some((leaf) => selected_values.has(leaf.value)) && !all_selected
  );
  const selected_leaves = $derived(leaves.filter((leaf) => selected_values.has(leaf.value)));
  const has_existing_in_selection = $derived(
    selected_leaves.some((leaf) => leaf.has_existing_translations)
  );
  const can_queue = $derived(
    selected_leaves.length > 0 &&
      (!auto_approved || !has_existing_in_selection || overwrite_confirmed === 'yes')
  );

  const trigger_mut = createMutation(() => ({
    mutationFn: () =>
      client.batch_ai.trigger_batch_text_translation.mutate({
        auto_approved,
        include_english_context: is_non_english && include_english_context,
        project_id: $project_state!.project_id,
        project_key: $project_state!.project_key,
        lang_id: active_lang_id!,
        paths: selected_leaves.map((leaf) => ({ path_params: leaf.path_params }))
      }),
    onSuccess: async (data) => {
      await invalidate_batch_ai_queries({ project_id: $project_state?.project_id });
      toast.success(`Batch ${data.batch_id} queued (${data.item_count} path(s))`);
      dialog_open = false;
    },
    onError: (err) => toast.error(err.message || 'Failed to queue batch translation')
  }));

  function open_dialog() {
    auto_approved = true;
    overwrite_confirmed = 'no';
    include_english_context = is_non_english;
    selected_values = new Set();
    dialog_open = true;
  }

  let did_init_selection = $state(false);
  $effect(() => {
    if (!dialog_open) {
      did_init_selection = false;
      return;
    }
    if (did_init_selection || !targets_q.isSuccess || !targets_q.data) return;
    const current = targets_q.data.current_value;
    const next = new Set<number>();
    if (current !== null) next.add(current);
    untrack(() => {
      selected_values = next;
      did_init_selection = true;
    });
  });

  function toggle_value(value: number, checked: boolean) {
    const next = new Set(untrack(() => selected_values));
    if (checked) next.add(value);
    else next.delete(value);
    selected_values = next;
  }

  function toggle_all(checked: boolean) {
    selected_values = checked ? new Set(leaves.map((leaf) => leaf.value)) : new Set();
  }
</script>

{#if active_lang_id !== null && $project_state}
  <Button
    type="button"
    size="sm"
    variant="outline"
    class="h-8 gap-1 px-2.5 text-sm font-bold text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
    onclick={open_dialog}
  >
    <Icon src={AIIcon} class="text-base" />
    Batch Translate
  </Button>

  <Dialog.Root
    bind:open={dialog_open}
    onOpenChange={(open) => {
      if (!open && trigger_mut.isPending) return;
      dialog_open = open;
    }}
  >
    <Dialog.Content class="flex max-h-[90vh] w-[min(96vw,42rem)] flex-col gap-4 sm:max-w-xl">
      <Dialog.Header>
        <Dialog.Title>Batch Translate {level_name}</Dialog.Title>
        <Dialog.Description>
          Queue background OpenAI batch translation for selected leaf nodes. Source text is loaded
          on the server.
        </Dialog.Description>
      </Dialog.Header>

      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span class="font-medium">
          Selected {selected_leaves.length}/{leaves.length}
        </span>
        <Button
          size="sm"
          class="animate-pulse bg-violet-600 text-white hover:bg-violet-700"
          disabled={trigger_mut.isPending || !can_queue}
          onclick={() => trigger_mut.mutate()}
        >
          {trigger_mut.isPending ? 'Queuing…' : 'Generate'}
        </Button>
      </div>

      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox bind:checked={auto_approved} />
        Auto Save when complete
      </label>

      {#if is_non_english}
        <label class="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={include_english_context}
            onCheckedChange={(checked) => (include_english_context = checked === true)}
          />
          <span>Include English translation context</span>
        </label>
      {/if}

      {#if auto_approved && has_existing_in_selection}
        <div
          class="space-y-2 rounded-md border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-700/50 dark:bg-amber-950/20"
        >
          <p
            class="flex items-start gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400"
          >
            <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span
              >Auto Save will overwrite existing translations for one or more selected paths.</span
            >
          </p>
          <fieldset class="space-y-1.5">
            <legend class="text-xs font-medium text-amber-800 dark:text-amber-300">
              Overwrite existing translations?
            </legend>
            <RadioGroup.Root
              bind:value={overwrite_confirmed}
              class="flex flex-wrap gap-x-4 gap-y-1"
            >
              <div class="flex items-center gap-1.5">
                <RadioGroup.Item value="no" id="batch-group-overwrite-no" />
                <Label for="batch-group-overwrite-no" class="cursor-pointer text-xs font-normal"
                  >No</Label
                >
              </div>
              <div class="flex items-center gap-1.5">
                <RadioGroup.Item value="yes" id="batch-group-overwrite-yes" />
                <Label for="batch-group-overwrite-yes" class="cursor-pointer text-xs font-normal"
                  >Yes</Label
                >
              </div>
            </RadioGroup.Root>
          </fieldset>
        </div>
      {/if}

      <ScrollArea class="h-[min(50vh,24rem)] rounded-md border p-2">
        {#if targets_q.isLoading}
          <p class="p-2 text-sm text-muted-foreground">Loading targets…</p>
        {:else if leaves.length === 0}
          <p class="p-2 text-sm text-muted-foreground">No leaf nodes under this selection.</p>
        {:else}
          <div class="flex flex-col gap-1">
            <label
              class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                checked={all_selected}
                indeterminate={some_selected}
                onCheckedChange={(checked) => toggle_all(checked === true)}
              />
              <span class="text-sm font-medium">Select all</span>
            </label>
            <Separator class="my-1" />
            {#each leaves as leaf (leaf.value)}
              <label
                class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected_values.has(leaf.value)}
                  onCheckedChange={(checked) => toggle_value(leaf.value, checked === true)}
                />
                <span class="min-w-0 flex-1 truncate text-sm">
                  {leaf.value}. {leaf.name_dev}
                  <span class="text-muted-foreground">({leaf.text_count})</span>
                </span>
                {#if leaf.has_existing_translations}
                  <span class="text-[10px] text-amber-600 dark:text-amber-400">has trans</span>
                {/if}
              </label>
            {/each}
          </div>
        {/if}
      </ScrollArea>

      <Dialog.Footer>
        <Button
          variant="outline"
          onclick={() => (dialog_open = false)}
          disabled={trigger_mut.isPending}
        >
          Cancel
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
