<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { onMount, untrack } from 'svelte';
  import { writable } from 'svelte/store';
  import { z } from 'zod';
  import { LanguageIcon, MultimediaIcon } from '~/components/icons';
  import {
    LANG_LIST,
    LANG_LIST_IDS,
    lang_list_obj,
    SCRIPT_LIST,
    type script_list_type
  } from '~/state/lang_list';
  import {
    project_state,
    editing_status_on,
    viewing_script,
    selected_text_levels,
    BASE_SCRIPT,
    text_data_present,
    list_count,
    ai_tool_opened,
    trans_lang,
    view_translation_status,
    edit_language_typer_status,
    sanskrit_mode,
    typing_assistance_modal_opened,
    image_tool_opened
  } from '~/state/main_app/state.svelte';
  import {
    get_map_type,
    get_project_info_from_key,
    type project_keys_type
  } from '~/state/project_list';
  import { get_sa_mode, lipi_parivartak, load_parivartak_lang_data } from '~/tools/converter';
  import { delay } from '~/tools/delay';
  import { get_script_for_lang, get_text_font_class } from '~/tools/font_tools';
  import Icon from '~/tools/Icon.svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import Display from './display/Display.svelte';
  import {
    english_edit_status,
    project_map_q,
    user_project_info_q
  } from '~/state/main_app/data.svelte';
  import { user_info } from '~/state/user.svelte';
  import { BiEdit, BiHelpCircle } from 'svelte-icons-pack/bi';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { BsKeyboard } from 'svelte-icons-pack/bs';
  import { loadLocalConfig } from './load_local_config';
  import AiImageGenerator from './ai_image_tool/AIImageGenerator.svelte';

  const query_client = useQueryClient();

  let {
    first,
    first_name,
    second,
    second_name
  }: {
    first?: number;
    first_name?: string;
    second?: number;
    second_name?: string;
  } = $props();

  let mounted = $state(false);
  onMount(async () => {
    if (import.meta.env.DEV) {
      (async () => {
        const conf = await loadLocalConfig();
        if (conf.view_translation_status) $view_translation_status = true;
        if (conf.trans_lang)
          $trans_lang_mut.mutateAsync(3).then(() => {
            // 3 -> Hindi
            editing_status_on.set(true);
          });
        if (conf.editing_status_on) $editing_status_on = true;
        if (conf.image_tool_opened) $image_tool_opened = true;
        if (conf.ai_tool_opened) {
          $ai_tool_opened = true;
          $view_translation_status = true;
        }
      })();
    }
    if (browser && import.meta.env.PROD) {
      window.addEventListener('beforeunload', function (e) {
        if ($editing_status_on) {
          e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
          e.returnValue = ''; // Chrome requires returnValue to be set
        }
      });
    }
    await load_parivartak_lang_data(BASE_SCRIPT);
    mounted = true;
  });

  $effect(() => {
    // loading project map
    $project_map_q;
  });

  const project_info = $derived(get_project_info_from_key($project_state.project_key!));

  type option_type = { text?: string; value?: number };

  const get_link = (project_key: project_keys_type, first?: number, second?: number) => {
    let link = `/${project_key}`;
    if (first) {
      link += `/${first}`;
      if (second) {
        link += `/${second}`;
      }
    }
    return link;
  };

  $effect(() => {
    let link = window.location.pathname;
    if (project_info.levels === 3) {
      let second_value = $selected_text_levels[0]!;
      if (window.location.pathname.split('/').length >= 3) {
        const current_level_1_state = parseInt(window.location.pathname.split('/')[2]);
        if (current_level_1_state !== $selected_text_levels[1]) {
          second_value = null!;
        }
      }
      link = get_link($project_state.project_key!, $selected_text_levels[1]!, second_value);
    } else if (project_info.levels === 2) {
      link = get_link($project_state.project_key!, $selected_text_levels[0]!);
    }
    if (window.location.pathname !== link) goto(link);
  });

  const params_viewing_script_mut_schema = z.object({
    script: z.string(),
    update_viewing_script_selection: z.boolean().default(true)
  });
  let viewing_script_selection = writable(BASE_SCRIPT);
  let viewing_script_mut = createMutation({
    mutationKey: ['viewing_script'],
    mutationFn: async (params: z.infer<typeof params_viewing_script_mut_schema>) => {
      // viewing script should not be directly changed as the resoucres for that
      // language/script might not be loaded yet
      const args = params_viewing_script_mut_schema.parse(params);
      const script = args.script as script_list_type;
      if (!mounted) return script;
      await delay(350);
      await load_parivartak_lang_data(script);
      return script;
    },
    onSuccess(script, { update_viewing_script_selection }) {
      $viewing_script = script;
      if (update_viewing_script_selection) $viewing_script_selection = script;
    }
  });
  $effect(() => {
    const _viewing_script_mut = untrack(() => $viewing_script_mut);
    _viewing_script_mut.mutate({
      script: $viewing_script_selection,
      update_viewing_script_selection: false
    });
  });

  const transliterate_options = async (options: option_type[], script: script_list_type) => {
    if (!browser) return options;
    const transliterate_texts = await lipi_parivartak(
      options.map((v) => v.text!),
      BASE_SCRIPT,
      script
    );
    return options.map((v, i) => ({ ...v, text: transliterate_texts[i] }));
  };

  let trans_lang_selection = writable(0);
  $trans_lang = $trans_lang_selection;
  const trans_lang_mut = createMutation({
    mutationKey: ['trans_lang'],
    mutationFn: async (lang_id: number) => {
      if (!mounted || !browser || lang_id === 0) return lang_id;
      // loading trnaslation lang data for typing support
      await delay(300);
      let script = get_script_for_lang(lang_id);
      await Promise.all([
        $viewing_script_mut.mutateAsync({ script, update_viewing_script_selection: true })
      ]);
      return lang_id;
    },
    onSuccess(lang_id) {
      $trans_lang_selection = lang_id;
      $trans_lang = lang_id;
      query_client.invalidateQueries({ queryKey: ['sanskrit_mode_texts'] });
    }
  });
  $effect(() => {
    if ($editing_status_on && $trans_lang !== 0)
      load_parivartak_lang_data(LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)], 'src', true);
  });
  $effect(() => {
    const _trans_lang_mut = untrack(() => $trans_lang_mut);
    _trans_lang_mut.mutate($trans_lang_selection);
  });

  $effect(() => {
    $english_edit_status =
      $trans_lang === 0 &&
      ($user_info?.role === 'admin' ||
        ($user_project_info_q.isSuccess &&
          !!$user_info?.is_approved! &&
          $user_project_info_q.data
            .languages!.map((l) => l.lang_id)
            .includes(lang_list_obj.English)));
  });

  // Language Typing for Schwa Deletion
  let sanskrit_mode_texts = $derived(
    createQuery({
      queryKey: ['sanskrit_mode_texts'],
      enabled: browser && $editing_status_on && $trans_lang !== 0,
      queryFn: () =>
        lipi_parivartak(
          ['राम्', 'राम'],
          BASE_SCRIPT,
          LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)]
        ),
      placeholderData: ['राम्', 'राम']
    })
  );
  $effect(() => {
    (async () => {
      if (!$editing_status_on || $sanskrit_mode_texts.isFetching || !$sanskrit_mode_texts.isSuccess)
        return;
      if ($trans_lang === 0) return;
      $sanskrit_mode = await get_sa_mode(
        untrack(() => LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)])
      );
    })();
  });
</script>

<label class="block space-x-2 text-sm sm:space-x-2 sm:text-base">
  Script
  <Icon src={LanguageIcon} class="text-2xl sm:text-4xl" />
  <select
    class="select inline-block h-10 w-32 px-2 py-1 text-sm sm:h-12 sm:w-40 sm:py-0 sm:text-base"
    disabled={$viewing_script_selection !== BASE_SCRIPT && $viewing_script_mut.isPending}
    bind:value={$viewing_script_selection}
  >
    {#each SCRIPT_LIST as lang (lang)}
      <option value={lang}>{lang}</option>
    {/each}
  </select>
</label>
{#each { length: project_info.levels - 1 } as _, i}
  {@const level_name = project_info.level_names[project_info.levels - i - 1]}
  {#if project_info.levels === 3}
    {@const map_info = $project_map_q.isSuccess && get_map_type($project_map_q.data, 3)}
    {#if i === 0}
      {@render selecter({
        name: level_name,
        text_level_state_index: 1,
        initial_option: { value: first, text: first_name },
        options:
          map_info &&
          map_info.map((text_level) => ({
            text: text_level.name_dev,
            value: text_level.pos
          }))
      })}
    {:else if i === 1 && !!first}
      {@render selecter({
        name: level_name,
        text_level_state_index: 0,
        initial_option: { value: second, text: second_name },
        options:
          map_info &&
          map_info[first - 1].list.map((text_level) => ({
            text: text_level.name_dev,
            value: text_level.pos
          }))
      })}
    {/if}
  {:else if project_info.levels === 2}
    {@const map_info = $project_map_q.isSuccess && get_map_type($project_map_q.data, 2)}
    {#if i == 0}
      {@render selecter({
        name: level_name,
        text_level_state_index: 0,
        initial_option: { value: first, text: first_name },
        options:
          map_info &&
          map_info.map((text_level) => ({
            text: text_level.name_dev,
            value: text_level.pos
          }))
      })}
    {/if}
  {/if}
{/each}

{#snippet selecter({
  name,
  options,
  initial_option,
  text_level_state_index
}: {
  name: string;
  initial_option: option_type;
  options: false | option_type[];
  text_level_state_index: number;
})}
  <label class="block space-x-2 sm:space-x-3">
    <span class="text-sm font-bold sm:text-base">Select {name}</span>
    <select
      class={`${get_text_font_class($viewing_script)} select inline-block h-10 w-44 px-2 py-1 sm:h-12 sm:w-52`}
      disabled={$editing_status_on}
      bind:value={$selected_text_levels[text_level_state_index]}
    >
      <option value={null}>Select</option>
      {#if !options}
        {#if initial_option.value}
          <option value={initial_option.value} selected
            >{initial_option.value}. {initial_option.text}</option
          >
        {/if}
      {:else}
        {#await transliterate_options(options, $viewing_script)}
          {#each options as option}
            <option value={option.value}>{option.value}. {option.text}</option>
          {/each}
        {:then options_tr}
          {#each options_tr as option}
            <option value={option.value}>{option.value}. {option.text}</option>
          {/each}
        {/await}
      {/if}
    </select>
  </label>
{/snippet}

{#if $text_data_present}
  <div class="space-x-1 sm:space-x-3">
    {#if $project_state.levels > 1}
      {#if $selected_text_levels[0] !== 1}
        <button
          onclick={() => $selected_text_levels[0]!--}
          in:scale
          out:slide
          disabled={$editing_status_on}
          class={'btn rounded-lg bg-tertiary-800 px-1 py-1 pt-1.5 text-sm font-bold text-white sm:px-2 sm:py-1 sm:text-sm'}
        >
          <Icon class="-mt-1 text-xl" src={TiArrowBackOutline} />
          Previous
        </button>
      {/if}
      {#if $selected_text_levels[0] !== $list_count}
        <button
          onclick={() => ($selected_text_levels[0]! += 1)}
          in:scale
          out:slide
          disabled={$editing_status_on}
          class={'btn rounded-lg bg-tertiary-800 px-1 py-1 pt-1.5 text-sm font-bold text-white sm:px-2 sm:py-1 sm:text-sm'}
        >
          Next
          <Icon class="-mt-1 text-xl" src={TiArrowForwardOutline} />
        </button>
      {/if}
    {/if}
    {#if !($ai_tool_opened && $user_info && $user_info.role === 'admin')}
      {#if !$view_translation_status}
        <button
          onclick={() => {
            $view_translation_status = true;
          }}
          class="btn rounded-lg bg-primary-800 px-2 py-1 text-sm font-bold text-white sm:text-sm dark:bg-primary-700"
          >View Translations</button
        >
        {@render btn_multi()}
      {:else}
        <div class="mt-2 block space-x-1.5 sm:mt-0 sm:inline-block sm:space-x-0">
          <label class="mr-1 inline-block space-x-1.5 text-sm sm:mr-3 sm:space-x-4 sm:text-base">
            Translation
            <Icon src={LanguageIcon} class="text-xl sm:text-2xl" />
            <select
              disabled={$editing_status_on || $viewing_script_mut.isPending}
              class="select inline-block w-24 px-1 py-1 text-sm sm:w-32 sm:px-2 sm:text-base"
              bind:value={$trans_lang_selection}
            >
              <!-- $trans_lang_mut.isPending || -->
              <option value={0}>English</option>
              {#each LANG_LIST as lang, i (lang)}
                {#if lang !== 'English'}
                  <option value={LANG_LIST_IDS[i]}>{lang}</option>
                {/if}
              {/each}
            </select>
          </label>
          {#if !$editing_status_on && $user_info && $user_info.is_approved}
            {@const languages =
              $user_info.role !== 'admin' && $user_project_info_q.isSuccess
                ? $user_project_info_q.data.languages!.map((l) => l.lang_id)
                : []}
            {#if $trans_lang !== 0 && ($user_info.role === 'admin' || languages.indexOf($trans_lang) !== -1)}
              <button
                onclick={() => ($editing_status_on = true)}
                class="my-1 btn inline-block rounded-lg bg-secondary-700 px-1 py-1 text-sm font-bold text-white sm:px-2 sm:text-sm dark:bg-secondary-800"
              >
                <Icon src={BiEdit} class="text-xl sm:text-2xl" />
                Edit
              </button>
            {:else if $trans_lang === 0 && ($user_info.role === 'admin' || languages.indexOf(1) !== -1)}
              <!-- 1 -> English -->
              <button
                onclick={() => ($editing_status_on = true)}
                class="my-1 btn inline-block rounded-lg bg-secondary-700 px-1 py-1 text-sm font-bold text-white sm:px-2 sm:text-sm dark:bg-secondary-800"
              >
                <Icon src={BiEdit} class="text-xl sm:text-2xl" />
                Edit English
              </button>
            {/if}
          {/if}
          {@render btn_multi()}
        </div>
      {/if}
    {/if}
    {#snippet btn_multi()}
      <button class="m-0 btn p-0">
        <Icon
          src={MultimediaIcon}
          class="text-2xl text-orange-500 sm:text-3xl dark:text-amber-200"
        />
      </button>
    {/snippet}
  </div>
{/if}
{#if $trans_lang !== 0 && $editing_status_on && !($ai_tool_opened && $user_info && $user_info.role === 'admin')}
  <div class="flex space-x-2.5 sm:space-x-4">
    <Switch
      name="edit_lang"
      checked={$edit_language_typer_status}
      stateFocused="outline-hidden select-none"
      onCheckedChange={(e) => ($edit_language_typer_status = e.checked)}
    >
      <Icon src={BsKeyboard} class="text-4xl" />
    </Switch>
    {#if $sanskrit_mode_texts.isSuccess && !$sanskrit_mode_texts.isFetching}
      <select
        disabled={!$edit_language_typer_status}
        bind:value={$sanskrit_mode}
        class="select w-28 px-1 py-1 text-sm text-clip"
      >
        <option value={1}>rAm ➔ {$sanskrit_mode_texts.data[0]}</option>
        <option value={0}>rAm ➔ {$sanskrit_mode_texts.data[1]}</option>
      </select>
    {/if}
    <button
      class="btn rounded-md p-0 text-sm outline-hidden"
      title={'Language Typing Assistance'}
      onclick={() => ($typing_assistance_modal_opened = true)}
    >
      <Icon src={BiHelpCircle} class="mt-1 text-3xl text-sky-500 dark:text-sky-400" />
    </button>
    <span class="mt-2 hidden text-center text-sm text-stone-500 sm:inline-block dark:text-stone-400"
      >Use <span class="font-semibold">Alt+x</span> to toggle</span
    >
  </div>
{/if}
{#if $text_data_present}
  {#if !$ai_tool_opened}
    <div in:fade out:fade>
      <Display />
    </div>
  {:else}
    <AiImageGenerator />
  {/if}
{/if}
