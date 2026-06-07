<script lang="ts">
  import { client } from '~/api/client';
  import {
    editing_mode,
    selected_translation_lang_ids,
    TEXT_MODEL_LIST,
    project_state,
    selected_text_levels,
    text_data_present
  } from '~/state/main_app/state.svelte';
  import {
    active_text_data_q_options,
    active_trans_en_data_q_options,
    get_trans_slot_data_query_keys,
    project_list_q_options,
    trans_slot_data_q_options
  } from '~/state/main_app/data.svelte';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import { AIIcon } from '~/components/icons';
  import Icon from '~/tools/Icon.svelte';
  import { get_result_from_trigger_run_id } from '~/tools/trigger';
  import pretty_ms from 'pretty-ms';
  import { OiStopwatch16 } from 'svelte-icons-pack/oi';
  import { onDestroy } from 'svelte';
  import { main_app_ai_translate_in_progress } from '~/state/main_app_content_edit_dirty.svelte';
  import { LANG_LIST, LANG_LIST_IDS, lang_list_obj } from '~/state/lang_list';
  import { get_project_from_id } from '~/state/project_list';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import * as Select from '$lib/components/ui/select';
  import Label from '$lib/components/ui/label/label.svelte';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  const query_client = useQueryClient();

  const project_list_q = createQuery(() => project_list_q_options());

  const text_data_q = createQuery(() =>
    active_text_data_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );

  const trans_slot_data_query_key = $derived(
    get_trans_slot_data_query_keys(
      $selected_translation_lang_ids,
      $selected_text_levels,
      $project_state
    )
  );

  const trans_slot_1_data_q = createQuery(() =>
    trans_slot_data_q_options(
      0,
      $selected_translation_lang_ids,
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );

  const trans_slot_2_data_q = createQuery(() =>
    trans_slot_data_q_options(
      1,
      $selected_translation_lang_ids,
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

  let show_time_status = $state(false);
  let dialog_open = $state(false);
  let include_english_context = $state(false);
  let translate_error = $state<string | null>(null);
  let overwrite_confirmed = $state<'yes' | 'no'>('no');

  onDestroy(() => {
    show_time_status = false;
    main_app_ai_translate_in_progress.set(false);
  });

  $effect(() => {
    if (show_time_status) {
      const t_id = setTimeout(() => (show_time_status = false), 10 * 1000);
      return () => clearTimeout(t_id);
    }
  });

  const active_translation_slot = $derived(
    $editing_mode === '1st_lang' ? 0 : $editing_mode === '2nd_lang' ? 1 : null
  );

  const active_translation_lang_id = $derived(
    active_translation_slot === null
      ? null
      : $selected_translation_lang_ids[active_translation_slot]
  );

  const active_translation_query = $derived(
    active_translation_slot === 0 ? trans_slot_1_data_q : trans_slot_2_data_q
  );

  const active_translation_name = $derived(
    active_translation_lang_id === null
      ? ''
      : LANG_LIST[LANG_LIST_IDS.indexOf(active_translation_lang_id)]!
  );

  const is_non_english_target = $derived(
    active_translation_lang_id !== null && active_translation_lang_id !== lang_list_obj.English
  );

  const english_context_available = $derived(
    trans_en_data_q.isSuccess && (trans_en_data_q.data?.size ?? 0) > 0
  );

  function open_translate_dialog() {
    translate_error = null;
    overwrite_confirmed = 'no';
    if (is_non_english_target) include_english_context = english_context_available;
    dialog_open = true;
  }

  function handle_dialog_open_change(open: boolean) {
    if (!open && translate_sarga_mut.isPending) return;
    dialog_open = open;
    if (!open) {
      translate_error = null;
      overwrite_confirmed = 'no';
    }
  }

  let selected_model: keyof typeof TEXT_MODEL_LIST = $state('gpt-5.2');

  const can_show_translate_ui = $derived.by(() => {
    if (active_translation_slot === null || active_translation_lang_id === null) return false;
    if (!$project_state?.project_id || !project_list_q.isSuccess) return false;
    if (!text_data_q.isSuccess || !text_data_q.data?.length) return false;
    return active_translation_query.isSuccess;
  });

  const has_existing_translations = $derived(
    active_translation_query.isSuccess && (active_translation_query.data?.size ?? 0) > 0
  );

  const can_confirm_translate = $derived(
    !has_existing_translations || overwrite_confirmed === 'yes'
  );

  const translate_sarga_mut = createMutation(() => ({
    mutationFn: async (
      input: Parameters<typeof client.ai.trigger_funcs.translate_trigger.mutate>[0]
    ) => {
      show_time_status = false;
      const out = await client.ai.trigger_funcs.translate_trigger.mutate(input);
      return await get_result_from_trigger_run_id<typeof out.output_type>(out.run_id!);
    },
    async onSuccess(response) {
      response = response!;
      if (!response.success) {
        translate_error = response.error ?? 'Translation failed';
        return;
      }

      const slot = active_translation_slot;
      if (slot === null) return;

      const translations = response.translations;
      const text_data = text_data_q.data;
      if (
        !text_data ||
        translations.length !== text_data.length ||
        translations.some((v, i) => v.index !== i)
      ) {
        console.error('Translation Rejected: Length mismatch or index mismatch');
        console.error(translations);
        translate_error = 'Translation rejected: length or index mismatch';
        return;
      }

      const slot_query = slot === 0 ? trans_slot_1_data_q : trans_slot_2_data_q;
      const new_data = new Map(slot_query.data);
      for (const translation of translations) {
        const positional_index = translation.index;
        if (positional_index < 0 || positional_index >= text_data.length) {
          console.error('Translation Rejected: out-of-range positional index', translation);
          translate_error = 'Translation rejected: out-of-range index';
          return;
        }
        new_data.set(text_data[positional_index]!.index, translation.text);
      }

      const query_key = trans_slot_data_query_key[slot];
      await query_client.setQueryData(query_key, new_data);
      show_time_status = true;
      translate_error = null;
      dialog_open = false;
      toast.success(`AI translation to ${active_translation_name} completed`);
    },
    onError(err) {
      translate_error = err.message || 'Translation failed';
    }
  }));

  $effect(() => {
    main_app_ai_translate_in_progress.set(translate_sarga_mut.isPending);
  });

  async function translate_sarga_func() {
    const slot = active_translation_slot;
    const lang_id = active_translation_lang_id;
    const project_id = $project_state?.project_id;
    if (slot === null || lang_id === null || !project_id || !text_data_q.data) return;
    if (!project_list_q.isSuccess || !project_list_q.data) {
      translate_error = 'Project list is not loaded yet';
      return;
    }

    const project = get_project_from_id(project_id, project_list_q.data);
    if (!project) {
      translate_error = 'Project not found';
      return;
    }

    const english_data =
      include_english_context && is_non_english_target ? trans_en_data_q.data : undefined;

    const texts_obj_list = text_data_q.data.map((shloka_line) => {
      let english_translation: string | undefined;
      if (english_data?.has(shloka_line.index))
        english_translation = english_data.get(shloka_line.index)!;
      return {
        index: shloka_line.index,
        text: shloka_line.text,
        ...(english_translation !== undefined && { english_translation })
      };
    });

    await translate_sarga_mut.mutateAsync({
      project_id,
      lang_id,
      model: selected_model,
      text_name: project.name,
      text_data: texts_obj_list
    });
  }
</script>

{#if can_show_translate_ui}
  <Dialog.Root open={dialog_open} onOpenChange={handle_dialog_open_change}>
    <Button
      variant="secondary"
      size="sm"
      class="h-7 px-2 text-xs"
      disabled={translate_sarga_mut.isPending}
      onclick={open_translate_dialog}
    >
      <Icon src={AIIcon} class="-mt-0.5 mr-1 text-lg" />
      Translate with AI
    </Button>
    <Dialog.Content
      class="max-w-md"
      showCloseButton={!translate_sarga_mut.isPending}
      onInteractOutside={(e) => {
        if (translate_sarga_mut.isPending) e.preventDefault();
      }}
    >
      {#if translate_sarga_mut.isPending}
        <div class="flex flex-col items-center gap-3 py-6 text-center">
          <LoaderCircle class="size-8 animate-spin text-muted-foreground" />
          <p class="text-sm font-medium">Currently translating to {active_translation_name}…</p>
          <p class="text-xs text-muted-foreground">This may take a minute. Please wait.</p>
        </div>
      {:else}
        <Dialog.Header>
          <Dialog.Title>Translate with AI?</Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground">
            This will translate shlokas to {active_translation_name}. You can review and edit the
            results before saving.
          </Dialog.Description>
        </Dialog.Header>
        {#if has_existing_translations}
          <div
            class="space-y-2 rounded-md border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-700/50 dark:bg-amber-950/20"
          >
            <p
              class="flex items-start gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400"
            >
              <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span
                >Your current translations will be overwritten with the new AI translations.</span
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
                  <RadioGroup.Item value="no" id="ai-translate-overwrite-no" />
                  <Label for="ai-translate-overwrite-no" class="cursor-pointer text-xs font-normal"
                    >No</Label
                  >
                </div>
                <div class="flex items-center gap-1.5">
                  <RadioGroup.Item value="yes" id="ai-translate-overwrite-yes" />
                  <Label for="ai-translate-overwrite-yes" class="cursor-pointer text-xs font-normal"
                    >Yes</Label
                  >
                </div>
              </RadioGroup.Root>
            </fieldset>
          </div>
        {/if}
        {#if translate_error}
          <p class="text-sm font-semibold text-destructive">{translate_error}</p>
        {/if}
        {#if is_non_english_target}
          <label class="flex cursor-pointer items-start gap-2 py-2 text-sm">
            <Checkbox
              checked={include_english_context}
              disabled={!english_context_available}
              onCheckedChange={(checked) => (include_english_context = checked === true)}
            />
            <span>
              Include English translation as context
              {#if !english_context_available}
                <span class="block text-xs text-muted-foreground">
                  No English translations available for this section.
                </span>
              {/if}
            </span>
          </label>
        {/if}
        <Dialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onclick={() => handle_dialog_open_change(false)}>Cancel</Button>
          <Button disabled={!can_confirm_translate} onclick={translate_sarga_func}>Translate</Button
          >
        </Dialog.Footer>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
  <Select.Root type="single" bind:value={selected_model as any}>
    <Select.Trigger
      class="inline-flex h-7 w-24 px-2 text-xs"
      title={TEXT_MODEL_LIST[selected_model][1]}
    >
      {TEXT_MODEL_LIST[selected_model][0]}
    </Select.Trigger>
    <Select.Content>
      {#each Object.entries(TEXT_MODEL_LIST) as [key, value] (key)}
        <Select.Item value={key} label={value[0]} title={value[1]} />
      {/each}
    </Select.Content>
  </Select.Root>
{:else if translate_sarga_mut.isSuccess && show_time_status}
  <span class="text-xs text-stone-500 select-none dark:text-stone-300">
    <Icon src={OiStopwatch16} class="text-base" />
    {pretty_ms(translate_sarga_mut.data.time_taken)}
  </span>
{/if}
