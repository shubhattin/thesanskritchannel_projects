<script lang="ts">
  import { transliterate_custom } from '~/tools/converter';
  import { fade, slide } from 'svelte/transition';
  import { cl_join } from '~/tools/cl_join';
  import {
    editing_status_on,
    BASE_SCRIPT,
    viewing_script,
    trans_lang,
    typing_assistance_modal_opened,
    view_translation_status,
    added_translations_indexes,
    edited_translations_indexes,
    edit_language_typer_status,
    sanskrit_mode,
    selected_text_levels,
    project_state
  } from '~/state/main_app/state.svelte';
  import {
    english_edit_status,
    text_data_q,
    trans_en_data_q,
    trans_lang_data_q,
    trans_lang_data_query_key,
    QUERY_KEYS,
    bulk_text_edit_status,
    bulk_text_data
  } from '~/state/main_app/data.svelte';
  import SaveEdit from './SaveEdit.svelte';
  import { useQueryClient } from '@tanstack/svelte-query';
  import Icon from '~/tools/Icon.svelte';
  import { BsClipboard2Check } from 'svelte-icons-pack/bs';
  import { copy_text_to_clipboard } from '~/tools/kry';
  import { OiCopy16 } from 'svelte-icons-pack/oi';
  import { get_font_family_and_size } from '~/tools/font_tools';
  import { LANG_LIST, LANG_LIST_IDS, type lang_list_type } from '~/state/lang_list';
  import { RiSystemAddLargeLine } from 'svelte-icons-pack/ri';
  import { Popover, Tabs } from '@skeletonlabs/skeleton-svelte';
  import BulkEdit from './bulk/BulkEdit.svelte';
  import AiTranslate from './ai_translate/AITranslate.svelte';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';

  const query_client = useQueryClient();

  let tab_edit_name: 'main' | 'bulk' = $state('main');
  let transliterated_data = $state<string[]>($text_data_q.data?.map((v) => v.text) ?? []);
  $effect(() => {
    // console.time('transliterate_sarga_data');
    transliterate_custom(
      $text_data_q.data?.map((v) => v.text) ?? [],
      BASE_SCRIPT,
      $viewing_script
    ).then((data) => {
      // console.timeEnd('transliterate_sarga_data');
      transliterated_data = data;
    });
  });

  async function update_trans_lang_data(index: number, text: string) {
    if (!$english_edit_status) {
      const new_data = new Map($trans_lang_data_q.data);
      new_data.set(index, text);
      await query_client.setQueryData($trans_lang_data_query_key, new_data);
    } else {
      const new_data = new Map($trans_en_data_q.data);
      new_data.set(index, text);
      await query_client.setQueryData(
        QUERY_KEYS.trans_lang_data(1, $selected_text_levels),
        new_data
      );
    }
  }
  // clipboard related
  let enable_copy_to_clipbaord = true;
  let copied_text_status = $state(false);
  $effect(() => {
    copied_text_status && setTimeout(() => (copied_text_status = false), 1400);
  });
  const copy_text = (text: string) => {
    if (!enable_copy_to_clipbaord) return;
    copy_text_to_clipboard(text);
    copied_text_status = true;
  };

  let text_portion_hovered = $state(false);

  const copy_sarga_shlokas_only = () => {
    copy_text(transliterated_data.join('\n\n'));
  };

  const copy_sarga_with_transliteration_and_translation = async () => {
    const texts_to_copy = await Promise.all(
      transliterated_data.map(async (shloka_lines, i) => {
        const normal_shloka = await transliterate_custom(
          $text_data_q.data![i].text,
          BASE_SCRIPT,
          'Normal'
        );
        const trans_index = i;
        let txt = `${shloka_lines}\n${normal_shloka}`;
        const lang_data = $trans_lang === 0 ? $trans_en_data_q.data : $trans_lang_data_q.data;
        if (lang_data && lang_data.has(trans_index)) txt += `\n\n${lang_data.get(trans_index)}`;
        return txt;
      })
    );
    copy_text(texts_to_copy.join('\n\n\n'));
  };

  let main_text_font_info = $derived(get_font_family_and_size($viewing_script));
  let trans_text_font_info = $derived(
    get_font_family_and_size(LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] as lang_list_type)
  );
  const en_trans_text_font_info = get_font_family_and_size('English');
  const input_func = async (trans_index: number, newValue: string) => {
    if (!$added_translations_indexes.includes(trans_index)) {
      $edited_translations_indexes.add(trans_index);
      $edited_translations_indexes = $edited_translations_indexes;
    }
    update_trans_lang_data(trans_index, newValue);
  };

  const detect_shortcut_pressed = (event: KeyboardEvent) => {
    event.preventDefault();
    if (event.altKey && event.key.toLowerCase() === 'x') {
      $edit_language_typer_status = !$edit_language_typer_status;
    }
  };

  $effect(() => {
    // reset bulk edit status on editting status toggles
    $editing_status_on;
    tab_edit_name = 'main';
    $bulk_text_data = '';
    $bulk_text_edit_status = false;
  });

  let copy_btn_popup_state = $state(false);

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
</script>

{#if $editing_status_on}
  <SaveEdit />
{/if}
<AiTranslate />
{#if copied_text_status}
  <div
    class="fixed right-2 bottom-2 z-50 cursor-default font-bold text-green-700 select-none dark:text-green-300"
  >
    <Icon src={BsClipboard2Check} />
    Copied to Clipboard
  </div>
{/if}
{#if !$editing_status_on}
  <div class="relative w-full">
    <Popover
      open={copy_btn_popup_state}
      onOpenChange={(e) => (copy_btn_popup_state = e.open)}
      positioning={{ placement: 'bottom-end' }}
      arrow={false}
      triggerBase={'btn absolute top-2 right-5 z-20 p-0 outline-hidden select-none'}
    >
      {#snippet trigger()}
        {#if text_portion_hovered}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            transition:fade={{ duration: 150 }}
            title="Copy Chapter Text"
            onmouseenter={() => (text_portion_hovered = true)}
          >
            <Icon src={OiCopy16} class="text-lg" />
          </span>
        {/if}
      {/snippet}
      {#snippet content()}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="z-70 space-y-1 card rounded-lg bg-slate-100 p-1 shadow-xl dark:bg-surface-900"
          onmouseenter={() => (text_portion_hovered = true)}
          onmouseleave={() => {
            copy_btn_popup_state = false;
          }}
        >
          <button
            onclick={copy_sarga_shlokas_only}
            class="btn block w-full rounded-md px-2 py-1 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Copy Shlokas
          </button>
          <button
            onclick={copy_sarga_with_transliteration_and_translation}
            class="btn block w-full rounded-md px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <div>Copy Shlokas</div>
            <div>with</div>
            <div>Transliteratin</div>
            <div>and Translation</div>
          </button>
        </div>
      {/snippet}
    </Popover>
  </div>
{/if}

{#if !$editing_status_on}
  {@render main()}
{:else}
  <Tabs
    value={tab_edit_name}
    onValueChange={(e) => (tab_edit_name = e.value as typeof tab_edit_name)}
    base="mt-4"
  >
    {#snippet list()}
      <Tabs.Control value={'main'}>Main</Tabs.Control>
      <Tabs.Control value={'bulk'}><span class="text-sm">Batch Edit</span></Tabs.Control>
    {/snippet}
    {#snippet content()}
      {#if tab_edit_name === 'main'}
        {@render main()}
      {:else}
        <BulkEdit bind:tab_edit_name />
      {/if}
    {/snippet}
  </Tabs>
{/if}
{#snippet main()}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={cl_join(
      'h-[85vh] overflow-scroll rounded-xl border-2 border-gray-400 p-0 dark:border-gray-600',
      $trans_en_data_q.isSuccess && 'h-[90vh]',
      $trans_lang_data_q.isSuccess && 'h-[95vh]',
      $editing_status_on && 'h-screen'
    )}
    onmouseenter={() => (text_portion_hovered = true)}
    onmouseleave={() => {
      if (!copy_btn_popup_state) text_portion_hovered = false;
    }}
  >
    {#if !$text_data_q.isFetching && $text_data_q.isSuccess}
      <div transition:fade={{ duration: 250 }} class="space-y-[0.15rem]">
        {#each transliterated_data as shloka_lines, i (i)}
          {@const is_spacing_allowed =
            ['bhagavadgita'].includes($project_state.project_key!) &&
            i > 2 &&
            i < transliterated_data.length - 2}
          <div class="rounded-lg px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-800">
            <div class="flex space-x-2">
              {#if $text_data_q.data[i]?.shloka_num || is_spacing_allowed}
                <div
                  class="flex items-center align-top text-[0.75rem] leading-6 text-gray-500 select-none dark:text-gray-300"
                >
                  {#if $text_data_q.data[i]?.shloka_num}
                    {$text_data_q.data[i].shloka_num}
                  {:else if is_spacing_allowed}
                    <span class="inline-block w-11"></span>
                  {/if}
                </div>
              {/if}
              <div class="mt-0 w-full space-y-1">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  style:font-size={`${main_text_font_info.size}rem`}
                  style:font-family={main_text_font_info.family}
                  ondblclick={() => copy_text(shloka_lines)}
                >
                  {#each shloka_lines.split('\n') as line_shlk}
                    <!-- if needed add 'whitespace-pre-wrap'2 -->
                    <div>
                      {line_shlk}
                    </div>
                  {/each}
                </div>
                {@render shloka_trans_display(i)}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#if $typing_assistance_modal_opened}
  {#await import('~/components/TypingAssistance.svelte') then TypingAssistance}
    <TypingAssistance.default
      sync_lang_script={LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)]}
      bind:modal_opened={$typing_assistance_modal_opened}
    />
  {/await}
{/if}

{#snippet shloka_trans_display(i: number)}
  {#if $view_translation_status && $trans_en_data_q.isSuccess}
    {#if $editing_status_on && $english_edit_status}
      <div transition:slide>
        {#if !$trans_en_data_q.data?.has(i)}
          <button
            onclick={async () => {
              await update_trans_lang_data(i, '');
              $added_translations_indexes.push(i);
              $added_translations_indexes = $added_translations_indexes;
            }}
            class="btn rounded-md bg-surface-500 px-1 py-[0.05rem] font-bold text-white dark:bg-surface-500"
          >
            <Icon src={RiSystemAddLargeLine} />
          </button>
        {:else}
          {@render edit_textarea_elm($trans_en_data_q.data, en_trans_text_font_info)}
        {/if}
      </div>
    {:else if $trans_en_data_q.data.size !== 0}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        transition:slide
        ondblclick={() => copy_text($trans_en_data_q.data.get(i)!)}
        class="text-stone-500 dark:text-slate-400"
        style:font-size={`${en_trans_text_font_info.size}rem`}
        style:font-family={en_trans_text_font_info.family}
      >
        {#if $trans_en_data_q.data.has(i)}
          <!-- Usually translations are single but still... -->
          {#each $trans_en_data_q.data.get(i)?.split('\n') ?? [''] as line_trans}
            {#if line_trans !== ''}
              <div>{line_trans}</div>
            {/if}
          {/each}
        {/if}
      </div>
    {/if}
  {/if}
  {#if $view_translation_status && $trans_lang_data_q.isSuccess}
    {#if $editing_status_on && !$english_edit_status}
      <div transition:slide>
        {#if !$trans_lang_data_q.data?.has(i)}
          <button
            onclick={async () => {
              await update_trans_lang_data(i, '');
              $added_translations_indexes.push(i);
              $added_translations_indexes = $added_translations_indexes;
            }}
            class="my-[0.05rem] btn rounded-md bg-surface-500 px-1 py-0 font-bold text-white dark:bg-surface-500"
          >
            <Icon src={RiSystemAddLargeLine} />
          </button>
        {:else}
          {@render edit_textarea_elm($trans_lang_data_q.data, trans_text_font_info)}
        {/if}
      </div>
    {:else if $trans_lang !== 0 && $trans_lang_data_q.data.size !== 0}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        transition:slide
        ondblclick={() => copy_text($trans_lang_data_q.data?.get(i)!)}
        class="text-yellow-700 dark:text-yellow-500"
        style:font-size={`${trans_text_font_info.size}rem`}
        style:font-family={trans_text_font_info.family}
      >
        {#if $trans_lang_data_q.data?.has(i)}
          <!-- Usually translations are single but still... -->
          {#each $trans_lang_data_q.data?.get(i)!.split('\n') as line_trans}
            {#if line_trans !== ''}
              <div>{line_trans}</div>
            {/if}
          {/each}
        {/if}
      </div>
    {/if}
  {/if}
  {#snippet edit_textarea_elm(
    lang_data: typeof $trans_lang_data_q.data,
    font_info: ReturnType<typeof get_font_family_and_size>
  )}
    <textarea
      value={lang_data?.get(i)}
      oninput={(e) => input_func(i, e.currentTarget.value)}
      onbeforeinput={(e) =>
        handleTypingBeforeInputEvent(
          ctx,
          e,
          (newValue) => {
            input_func(i, newValue);
          },
          $edit_language_typer_status && !$english_edit_status
        )}
      onblur={() => ctx.clearContext()}
      onkeydown={(e) => clearTypingContextOnKeyDown(e, ctx)}
      class="textarea h-28 w-full border-[2.5px] md:h-24"
      style:font-size={`${font_info.size}rem`}
      style:font-family={font_info.family}
      onkeyup={detect_shortcut_pressed}
    ></textarea>
  {/snippet}
{/snippet}
