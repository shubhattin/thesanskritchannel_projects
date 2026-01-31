<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import { TrOutlineHelpSquare } from 'svelte-icons-pack/tr';
  import Icon from '~/tools/Icon.svelte';
  import {
    selected_text_levels,
    trans_lang,
    sanskrit_mode,
    edit_language_typer_status,
    added_translations_indexes,
    edited_translations_indexes
  } from '~/state/main_app/state.svelte';
  import {
    trans_en_data_q,
    trans_lang_data_q,
    english_edit_status,
    bulk_text_edit_status,
    bulk_text_data,
    trans_lang_data_query_key,
    QUERY_KEYS,
    project_map_q,
    get_total_count
  } from '~/state/main_app/data.svelte';
  import { trans_map_to_text, text_to_trans_map } from './trans_bulk_funcs';
  import { get_font_family_and_size } from '~/tools/font_tools';
  import { LANG_LIST, LANG_LIST_IDS, type lang_list_type } from '~/state/lang_list';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import { OiSync16 } from 'svelte-icons-pack/oi';
  import { useQueryClient } from '@tanstack/svelte-query';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';

  const query_client = useQueryClient();

  let ctx = $derived(
    createTypingContext(
      (LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] as lang_list_type) ?? 'Devanagari',
      {
        includeInherentVowel: $sanskrit_mode !== 1
      }
    )
  );

  $effect(() => {
    ctx.ready;
  });

  let { tab_edit_name = $bindable() }: { tab_edit_name: 'main' | 'bulk' } = $props();

  let total_count = $state(0);

  $effect(() => {
    if (!$project_map_q.isSuccess) return;
    total_count = get_total_count($selected_text_levels);
  });

  let trans_text_font_info = $derived(
    $english_edit_status
      ? get_font_family_and_size('English')
      : get_font_family_and_size(LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] as lang_list_type)
  );
  $effect(() => {
    if (!$bulk_text_edit_status) {
      $bulk_text_data = trans_map_to_text(
        $english_edit_status ? $trans_en_data_q.data! : $trans_lang_data_q.data!,
        total_count
      );
    }
  });

  const sync_text_data_to_main = async () => {
    const trans_text_map = text_to_trans_map($bulk_text_data, total_count);
    const trans_data = new Map(
      $english_edit_status ? $trans_en_data_q.data! : $trans_lang_data_q.data!
    );
    trans_text_map.forEach((text, index) => {
      const prev_text = trans_data.get(index)!;
      if (!trans_data.has(index)) $added_translations_indexes.push(index);
      else if (
        prev_text != text &&
        !(
          prev_text.substring(0, prev_text.length - 1) === text &&
          prev_text[prev_text.length - 1] === '\n'
        ) // if the text is the same but ends with a new line, then ignore
      ) {
        $edited_translations_indexes.add(index);
        // console.log([index, prev_text, text]);
      }
      trans_data.set(index, text);
    });
    $added_translations_indexes = $added_translations_indexes;
    $edited_translations_indexes = $edited_translations_indexes;
    // updating query data
    if (!$english_edit_status) {
      await query_client.setQueryData($trans_lang_data_query_key, trans_data);
    } else {
      await query_client.setQueryData(
        QUERY_KEYS.trans_lang_data(1, $selected_text_levels),
        trans_data
      );
    }
    $bulk_text_edit_status = false;
    tab_edit_name = 'main';
  };

  const detect_shortcut_pressed = (event: KeyboardEvent) => {
    event.preventDefault();
    if (event.altKey && event.key.toLowerCase() === 'x') {
      $edit_language_typer_status = !$edit_language_typer_status;
    }
  };
</script>

<Accordion.Root type="single" class="w-full">
  <Accordion.Item value="help">
    <Accordion.Trigger class="flex items-center gap-2">
      <Icon src={TrOutlineHelpSquare} class="-m-1.5 -mt-2 text-2xl" />
      <span class="text-base font-bold">Instructions</span>
    </Accordion.Trigger>
    <Accordion.Content>
      <ul class="list-disc space-y-2 pl-5">
        <li>Each shloka should be separated by two or more blank lines</li>
        <li>
          <strong>Format 1</strong>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            <li>
              Shloka number can be indicated in either <code class="rounded bg-muted px-1"
                >{`{num}. {text}`}</code
              >
              or
              <code class="rounded bg-muted px-1">{`{num}: {text}`}</code> format.
            </li>
            <li>
              Three or more <code class="rounded bg-muted px-1">-(dashes)</code> will make the shloka
              being ignored or marked as non existent.
            </li>
            <li>You are free to place shlokas in any order in this format.</li>
          </ul>
        </li>
        <li>
          <strong>Format 2</strong>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            <li>
              If shlokas have missing index markers then they will be interpreted in the usual
              order, i.e. 0, 1, 2 to last.
            </li>
            <li>
              Shlokas have to be strictly in the same order and number. All the way from 0, 1, 2, 3
              ....., n.
            </li>
          </ul>
        </li>
      </ul>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>

<div class="mt-3 p-1">
  <div class="pb-2 text-sm">⚠️ Avoid using it for single/minor changes or unless necessary.</div>
  {#if !$bulk_text_edit_status}
    <div class="text-xs italic">Start Editing Text here...</div>
  {:else}
    {@const trans_map = text_to_trans_map($bulk_text_data, total_count)}
    <div class="space-x-2">
      <ConfirmModal
        popup_state={false}
        close_on_confirm={true}
        confirm_func={sync_text_data_to_main}
        title={'Sure to sync the text to Main Tab ?'}
        body_text={() =>
          'This will write the shloka contents to the main tab text which can then be verified and saved from there.' +
          '\nAlso be sure to verify for any sorts of distortions, it sometimes adds spaces or new lines on its own (nothing too serious). ' +
          'If you are adding to an empty non translated shloka it should be fine.'}
      >
        <button
          class="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 font-bold text-primary-foreground"
        >
          <Icon src={OiSync16} class="-my-1 text-lg" />
          Sync to Main
        </button>
      </ConfirmModal>
      <span class="text-xs font-bold">Shlokas Found: {trans_map.size}</span>
      <span class="text-xs font-semibold">Total Shlokas: {total_count}</span>
    </div>
  {/if}
</div>

<textarea
  style:font-size={`${trans_text_font_info.size}rem`}
  style:font-family={trans_text_font_info.family}
  class="mt-2.5 h-[60vh] w-full rounded-md border-2 border-input bg-background p-2"
  bind:value={$bulk_text_data}
  onbeforeinput={(e) =>
    handleTypingBeforeInputEvent(
      ctx,
      e,
      (newValue) => ($bulk_text_data = newValue),
      $edit_language_typer_status && !$english_edit_status
    )}
  onblur={() => ctx.clearContext()}
  onkeydown={(e) => clearTypingContextOnKeyDown(e, ctx)}
  onkeyup={detect_shortcut_pressed}
></textarea>
