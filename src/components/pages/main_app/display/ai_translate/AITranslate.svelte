<script lang="ts">
  import { client } from '~/api/client';
  import {
    editing_status_on,
    selected_text_levels,
    trans_lang,
    added_translations_indexes,
    TEXT_MODEL_LIST,
    project_state
  } from '~/state/main_app/state.svelte';
  import {
    QUERY_KEYS,
    trans_lang_data_q,
    text_data_q,
    trans_en_data_q,
    trans_lang_data_query_key,
    get_total_count,
    project_map_q
  } from '~/state/main_app/data.svelte';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { format_string_text } from '~/tools/kry';
  import trans_prompts from './translation_prompts.yaml';
  import { AIIcon } from '~/components/icons';
  import Icon from '~/tools/Icon.svelte';
  import { get_result_from_trigger_run_id } from '~/tools/trigger';
  import pretty_ms from 'pretty-ms';
  import { OiStopwatch16 } from 'svelte-icons-pack/oi';
  import { onDestroy } from 'svelte';
  import { get_lang_from_id, LANG_LIST, LANG_LIST_IDS, lang_list_obj } from '~/state/lang_list';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { get_project_from_id } from '~/state/project_list';
  import { encode } from '@toon-format/toon';

  const query_client = useQueryClient();

  let total_count = $derived($project_map_q.isSuccess ? get_total_count($selected_text_levels) : 0);

  let show_time_status = $state(false);

  onDestroy(() => {
    show_time_status = false;
    // ^ may be not needed
  });

  $effect(() => {
    if (show_time_status) {
      const t_id = setTimeout(() => (show_time_status = false), 10 * 1000);
      return () => clearTimeout(t_id);
    }
  });

  let selected_model: keyof typeof TEXT_MODEL_LIST = $state('gpt-5.2');

  const translate_sarga_mut = createMutation({
    mutationFn: async (
      input: Parameters<typeof client.ai.trigger_funcs.translate_trigger.mutate>[0]
    ) => {
      show_time_status = false;
      const out = await client.ai.trigger_funcs.translate_trigger.mutate(input);
      return await get_result_from_trigger_run_id<typeof out.output_type>(out.run_id!);
    },
    async onSuccess(response) {
      response = response!;
      if (!response.success) return;
      const translations = response.translations;
      if (translations.length !== $text_data_q.data!.length || translations.some((v, i) => v.index !== i || !v.text)) {
        console.error("Translation Rejected: Length mismatch or index mismatch");
        console.error(translations);
      }

      const new_data = new Map($trans_lang !== 0 ? $trans_lang_data_q.data : $trans_en_data_q.data);
      translations.forEach((translation) => {
        if (new_data.has(translation.index)) return;
        new_data.set(translation.index, translation.text);
        $added_translations_indexes.push(translation.index);
      });
      $added_translations_indexes = $added_translations_indexes;
      if ($trans_lang !== 0) await query_client.setQueryData($trans_lang_data_query_key, new_data);
      else
        await query_client.setQueryData(
          QUERY_KEYS.trans_lang_data(1, $selected_text_levels),
          new_data
        );
      show_time_status = true;
    }
  });

  async function translate_sarga_func() {
    // Sanskrit Shlokas + Transliteration + English Translation
    const texts_obj_list = $text_data_q.data!.map((shloka_line, i) => {
      let text = shloka_line.text;
      let trans: string | null = null;
      if ($trans_lang !== 0) {
        const lang_data = $trans_en_data_q.data;
        if (lang_data && lang_data.has(i)) trans = lang_data.get(i)!;
      }
      return {
        index: shloka_line.index,
        text: text,
        ...(trans !== null && { english_translation: trans })
      };
    });
    await $translate_sarga_mut.mutateAsync({
      project_id: $project_state.project_id!,
      lang_id: $trans_lang === 0 ? lang_list_obj['English'] : $trans_lang,
      model: selected_model,
      messages: [
        {
          role: 'user',
          content: format_string_text(
            $trans_lang !== 0
              ? trans_prompts.prompts[0].content
              : trans_prompts.prompts_english[0].content,
            {
              text_name: get_project_from_id($project_state.project_id!).name,
              text: encode(texts_obj_list),
              lang: $trans_lang !== 0 ? get_lang_from_id($trans_lang) : 'English'
            }
          )
        }
      ]
    });
  }

  let other_lang_allow_translate = $derived(
    $trans_lang !== 0 &&
      $trans_lang_data_q.isSuccess &&
      $trans_en_data_q.isSuccess &&
      ($trans_lang_data_q.data?.size ?? 0) < total_count && // atleast 1 untranslated shlokas should be there
      ($trans_en_data_q.data?.size ?? 0) >= total_count * 0.7 // atleast 70% of the translations should be there
  );
  let english_allow_translate = $derived(
    $trans_lang === 0 &&
      $trans_en_data_q.isSuccess &&
      ($trans_en_data_q.data?.size ?? 0) !== total_count
    // all english translations should not be there, anyway we wont be sending it as context to the API anyway
  );
</script>

{#if $editing_status_on && (other_lang_allow_translate || english_allow_translate)}
  <ConfirmModal
    popup_state={false}
    close_on_confirm={true}
    confirm_func={translate_sarga_func}
    title={'Are You Sure to translate the Chapter ?'}
    body_text={() => {
      return `This will translate the untranslated shlokas to ${$trans_lang !== 0 ? LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] : 'English'} which you can edit and then save.`;
    }}
  >
    <!-- description={`This will translate the untranslated shlokas to ${$trans_lang !== 0 ? LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] : 'English'} which you can edit and then save.`} -->
    <button
      disabled={$translate_sarga_mut.isPending}
      class="ml-3 btn inline-block rounded-lg bg-surface-600 px-2 py-1 text-white dark:bg-surface-600"
    >
      <Icon src={AIIcon} class="-mt-1 mr-1 text-2xl" />
      Translate with AI
    </button>
  </ConfirmModal>
  <select
    class="select ml-3 inline-block w-20 px-1 py-1 text-xs outline-hidden"
    bind:value={selected_model}
    title={TEXT_MODEL_LIST[selected_model][1]}
  >
    {#each Object.entries(TEXT_MODEL_LIST) as [key, value]}
      <option value={key} title={value[1]}>{value[0]}</option>
    {/each}
  </select>
{:else if $editing_status_on && $translate_sarga_mut.isSuccess && show_time_status}
  <span class="ml-4 text-xs text-stone-500 select-none dark:text-stone-300">
    <Icon src={OiStopwatch16} class="text-base" />
    {pretty_ms($translate_sarga_mut.data.time_taken)}
  </span>
{/if}
