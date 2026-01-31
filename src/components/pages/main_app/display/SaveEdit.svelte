<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import {
    selected_text_levels,
    trans_lang,
    editing_status_on,
    added_translations_indexes,
    edited_translations_indexes,
    project_state
  } from '~/state/main_app/state.svelte';
  import {
    trans_lang_data_q,
    trans_lang_data_query_key,
    english_edit_status,
    QUERY_KEYS,
    trans_en_data_q
  } from '~/state/main_app/data.svelte';
  import { delay } from '~/tools/delay';
  import { client } from '~/api/client';
  import { scale, slide } from 'svelte/transition';
  import { FiSave } from 'svelte-icons-pack/fi';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { lang_list_obj } from '~/state/lang_list';

  const query_client = useQueryClient();

  const save_data = createMutation({
    mutationKey: ['chapter', 'save_edited_data'],
    mutationFn: async ({
      added_indexes,
      edited_indexes
    }: {
      added_indexes: number[];
      edited_indexes: number[];
    }) => {
      if (!$english_edit_status ? !$trans_lang_data_q.isSuccess : !$trans_en_data_q.isSuccess)
        return;
      await delay(400);
      const data_source = $english_edit_status ? $trans_en_data_q : $trans_lang_data_q;
      const indexes = added_indexes.concat(edited_indexes);
      const data = indexes.map((index) => data_source.data?.get(index)!);
      const res = await client.translation.edit_translation.mutate({
        data,
        indexes,
        selected_text_levels: $selected_text_levels,
        project_id: $project_state.project_id!,
        lang_id: $trans_lang !== 0 ? $trans_lang : lang_list_obj['English']
      });
      if (res.success) {
        $added_translations_indexes = [];
        $edited_translations_indexes = new Set();
        $editing_status_on = false;
      }
    }
  });
  const save_data_func = () => {
    if ($edited_translations_indexes.size + $added_translations_indexes.length === 0) return;
    const added_indexes = $added_translations_indexes.map((index) => index);
    const edited_indexes = Array.from($edited_translations_indexes).map((index) => index);
    $save_data.mutate({ added_indexes, edited_indexes });
  };

  const cancel_edit_data = createMutation({
    mutationKey: ['chapter', 'cancel_edit_data'],
    mutationFn: async () => {
      if (!$english_edit_status ? !$trans_lang_data_q.isSuccess : !$trans_en_data_q.isSuccess)
        return;
      await delay(500);
      await query_client.invalidateQueries({
        queryKey: !$english_edit_status
          ? $trans_lang_data_query_key
          : QUERY_KEYS.trans_lang_data(1, $selected_text_levels)
      });
      $added_translations_indexes = [];
      $edited_translations_indexes = new Set();
      $editing_status_on = false;
      // ^ reset the data
    }
  });

  const cancel_edit_func = () => {
    if ($edited_translations_indexes.size + $added_translations_indexes.length === 0) {
      $cancel_edit_data.mutate();
      return;
    }
    // const added_indexes = $added_translations_indexes.map((index) => index);
    // const edited_indexes = Array.from($edited_translations_indexes).map((index) => index);
    $cancel_edit_data.mutate();
  };

  let cancel_popup_state = $state(false);
  let save_popup_state = $state(false);
</script>

<ConfirmModal
  bind:popup_state={save_popup_state}
  close_on_confirm={true}
  confirm_func={save_data_func}
  title="Sure to save Changes ?"
>
  {#snippet body()}
    {@const added_indexes = $added_translations_indexes.map((index) => index)}
    {@const edited_indexes = Array.from($edited_translations_indexes).map((index) => index)}
    <div>
      <span class="font-semibold">Edits ➔ {edited_indexes.length}</span>
      <!-- {#if edited_indexes.length > 0}
        <span>{`{ ${edited_indexes.join(', ')} }`}</span>
      {/if} -->
    </div>
    <div>
      <span class="font-semibold">Additions ➔ {added_indexes.length}</span>
    </div>
  {/snippet}
</ConfirmModal>
<button
  in:slide
  out:scale
  disabled={$save_data.isPending ||
    $added_translations_indexes.length + $edited_translations_indexes.size === 0}
  class="btn bg-primary-700 dark:bg-primary-700 rounded-lg px-1 py-1 text-white"
  onclick={() => (save_popup_state = true)}
>
  <Icon src={FiSave} class="text-2xl" />
  <span class="text-sm font-semibold sm:text-base">Save</span>
</button>

<ConfirmModal
  bind:popup_state={cancel_popup_state}
  close_on_confirm={true}
  confirm_func={cancel_edit_func}
  title="Sure to discard Changes ?"
>
  {#snippet body()}
    {@const added_indexes = $added_translations_indexes.map((index) => index)}
    {@const edited_indexes = Array.from($edited_translations_indexes).map((index) => index)}
    <div>
      <span class="font-semibold">Edits ➔ {edited_indexes.length}</span>
    </div>
    <div>
      <span class="font-semibold">Additions ➔ {added_indexes.length}</span>
    </div>
  {/snippet}
</ConfirmModal>
<button
  in:slide
  out:scale
  disabled={$cancel_edit_data.isPending}
  class="btn bg-error-700 dark:bg-error-600 ml-3 rounded-lg px-1 py-1 font-semibold text-white"
  onclick={() => {
    if ($edited_translations_indexes.size + $added_translations_indexes.length === 0) {
      $cancel_edit_data.mutate();
      return;
    }
    cancel_popup_state = true;
  }}
>
  <Icon src={AiOutlineClose} class="text-2xl" />
  <span class="text-sm sm:text-base">Cancel</span>
</button>
