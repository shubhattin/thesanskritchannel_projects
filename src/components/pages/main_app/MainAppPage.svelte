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
    script_list_obj,
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
  import { transliterate_custom } from '~/tools/converter';
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
  import { is_current_app_scope, user_info } from '~/state/user.svelte';
  import { BiEdit, BiHelpCircle } from 'svelte-icons-pack/bi';
  import { Switch } from '$lib/components/ui/switch';
  import { BsKeyboard } from 'svelte-icons-pack/bs';
  import { loadLocalConfig } from './load_local_config';
  import AiImageGenerator from './ai_image_tool/AIImageGenerator.svelte';
  import { preloadScriptData, type ScriptLangType } from 'lipilekhika';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';

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
    await preloadScriptData(BASE_SCRIPT);
    mounted = true;
  });

  $effect(() => {
    // loading project map
    $project_map_q.data;
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
      await preloadScriptData(script);
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
    const transliterate_texts = await transliterate_custom(
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
      preloadScriptData(LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] as ScriptLangType);
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
          !!$is_current_app_scope &&
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
        transliterate_custom(
          ['राम्', 'राम'],
          BASE_SCRIPT,
          LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] as ScriptLangType
        ),
      placeholderData: ['राम्', 'राम']
    })
  );
  const SPECIFIC_SCHWA = {
    scripts: [
      script_list_obj.Bengali,
      script_list_obj.Gujarati,
      script_list_obj.Odia,
      script_list_obj.Gurumukhi
    ],
    langs: [lang_list_obj.Hindi, lang_list_obj.Marathi, lang_list_obj.Nepali, lang_list_obj.Punjabi]
  } as const;
  $effect(() => {
    (async () => {
      if (!$editing_status_on || $sanskrit_mode_texts.isFetching || !$sanskrit_mode_texts.isSuccess)
        return;
      if ($trans_lang === 0) return;
      let schwa_deletion = false;
      if (
        SPECIFIC_SCHWA.scripts.includes(script_list_obj[$viewing_script]) ||
        SPECIFIC_SCHWA.langs.includes($trans_lang)
      ) {
        schwa_deletion = true;
      }
      $sanskrit_mode = !schwa_deletion ? 1 : 0; // no inherent vowel(schwa deletion) by default
    })();
  });
</script>

<label class="block space-x-2 text-sm sm:space-x-2 sm:text-base">
  Script
  <Icon src={LanguageIcon} class="text-2xl sm:text-4xl" />
  <Select.Root
    type="single"
    bind:value={$viewing_script_selection as any}
    disabled={$viewing_script_selection !== BASE_SCRIPT && $viewing_script_mut.isPending}
  >
    <Select.Trigger class="inline-flex h-10 w-32 px-2 py-1 text-sm sm:h-12 sm:w-40 sm:text-base">
      {$viewing_script_selection}
    </Select.Trigger>
    <Select.Content>
      {#each SCRIPT_LIST as lang (lang)}
        <Select.Item value={lang}>{lang}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
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
    <Select.Root
      type="single"
      value={$selected_text_levels[text_level_state_index]?.toString() ?? ''}
      onValueChange={(v) => {
        $selected_text_levels[text_level_state_index] = v ? parseInt(v) : null;
      }}
      disabled={$editing_status_on}
    >
      <Select.Trigger
        class={`${get_text_font_class($viewing_script)} inline-flex h-10 w-44 px-2 py-1 sm:h-12 sm:w-52`}
      >
        {$selected_text_levels[text_level_state_index]
          ? `${$selected_text_levels[text_level_state_index]}. ${
              options
                ? (options.find((o) => o.value === $selected_text_levels[text_level_state_index])
                    ?.text ?? '')
                : (initial_option.text ?? '')
            }`
          : 'Select'}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="">Select</Select.Item>
        {#if !options}
          {#if initial_option.value}
            <Select.Item value={initial_option.value.toString()}>
              {initial_option.value}. {initial_option.text}
            </Select.Item>
          {/if}
        {:else}
          {#await transliterate_options(options, $viewing_script)}
            {#each options as option}
              <Select.Item value={option.value!.toString()}
                >{option.value}. {option.text}</Select.Item
              >
            {/each}
          {:then options_tr}
            {#each options_tr as option}
              <Select.Item value={option.value!.toString()}
                >{option.value}. {option.text}</Select.Item
              >
            {/each}
          {/await}
        {/if}
      </Select.Content>
    </Select.Root>
  </label>
{/snippet}

{#if $text_data_present}
  <div class="space-x-1 sm:space-x-3">
    {#if $project_state.levels > 1}
      {#if $selected_text_levels[0] !== 1}
        <Button
          onclick={() => $selected_text_levels[0]!--}
          variant="secondary"
          size="sm"
          disabled={$editing_status_on}
        >
          <Icon class="-mt-1 text-xl" src={TiArrowBackOutline} />
          Previous
        </Button>
      {/if}
      {#if $selected_text_levels[0] !== $list_count}
        <Button
          onclick={() => ($selected_text_levels[0]! += 1)}
          variant="secondary"
          size="sm"
          disabled={$editing_status_on}
        >
          Next
          <Icon class="-mt-1 text-xl" src={TiArrowForwardOutline} />
        </Button>
      {/if}
    {/if}
    {#if !($ai_tool_opened && $user_info && $user_info.role === 'admin')}
      {#if !$view_translation_status}
        <Button
          onclick={() => {
            $view_translation_status = true;
          }}
          size="sm">View Translations</Button
        >
        {@render btn_multi()}
      {:else}
        <div class="mt-2 block space-x-1.5 sm:mt-0 sm:inline-block sm:space-x-2">
          <label class="mr-1 inline-block space-x-1.5 text-sm sm:mr-3 sm:space-x-4 sm:text-base">
            Translation
            <Icon src={LanguageIcon} class="text-xl sm:text-2xl" />
            <Select.Root
              type="single"
              value={$trans_lang_selection.toString()}
              onValueChange={(v) => {
                $trans_lang_selection = parseInt(v) || 0;
              }}
              disabled={$editing_status_on || $viewing_script_mut.isPending}
            >
              <Select.Trigger class="inline-flex w-24 px-2 py-1 text-sm sm:w-32 sm:text-base">
                {LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang_selection)] ?? 'English'}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="0">English</Select.Item>
                {#each LANG_LIST as lang, i (lang)}
                  {#if lang !== 'English'}
                    <Select.Item value={LANG_LIST_IDS[i].toString()}>{lang}</Select.Item>
                  {/if}
                {/each}
              </Select.Content>
            </Select.Root>
          </label>
          {#if !$editing_status_on && $user_info && $is_current_app_scope}
            {@const languages =
              $user_info.role !== 'admin' && $user_project_info_q.isSuccess
                ? $user_project_info_q.data.languages!.map((l) => l.lang_id)
                : []}
            {#if $trans_lang !== 0 && ($user_info.role === 'admin' || languages.indexOf($trans_lang) !== -1)}
              <Button
                onclick={() => ($editing_status_on = true)}
                variant="secondary"
                size="sm"
                class="my-1"
              >
                <Icon src={BiEdit} class="text-xl sm:text-2xl" />
                Edit
              </Button>
            {:else if $trans_lang === 0 && ($user_info.role === 'admin' || languages.indexOf(1) !== -1)}
              <!-- 1 -> English -->
              <Button
                onclick={() => ($editing_status_on = true)}
                variant="secondary"
                size="sm"
                class="my-1"
              >
                <Icon src={BiEdit} class="text-xl sm:text-2xl" />
                Edit English
              </Button>
            {/if}
          {/if}
          {@render btn_multi()}
        </div>
      {/if}
    {/if}
    {#snippet btn_multi()}
      {#await import('./multimedia/MultiMediaLinks.svelte')}
        <Button variant="ghost" size="icon" class="outline-none">
          <Icon
            src={MultimediaIcon}
            class="text-2xl text-orange-600 sm:text-3xl dark:text-amber-200"
          />
        </Button>
      {:then MultiMediaLinks}
        <MultiMediaLinks.default />
      {/await}
    {/snippet}
  </div>
{/if}
{#if $trans_lang !== 0 && $editing_status_on && !($ai_tool_opened && $user_info && $user_info.role === 'admin')}
  <div class="flex space-x-2.5 sm:space-x-4">
    <div class="flex items-center gap-2">
      <Switch
        id="edit_lang"
        bind:checked={$edit_language_typer_status}
        class="focus:outline-none"
      />
      <Icon src={BsKeyboard} class="text-4xl" />
    </div>
    {#if $sanskrit_mode_texts.isSuccess && !$sanskrit_mode_texts.isFetching}
      <Select.Root
        type="single"
        bind:value={$sanskrit_mode as any}
        disabled={!$edit_language_typer_status}
      >
        <Select.Trigger class="w-28 text-sm">
          {$sanskrit_mode === 1
            ? 'rAm ➔ ' + $sanskrit_mode_texts.data[0]
            : 'rAm ➔ ' + $sanskrit_mode_texts.data[1]}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={1 as any}>rAm ➔ {$sanskrit_mode_texts.data[0]}</Select.Item>
          <Select.Item value={0 as any}>rAm ➔ {$sanskrit_mode_texts.data[1]}</Select.Item>
        </Select.Content>
      </Select.Root>
    {/if}
    <Button
      variant="ghost"
      size="icon"
      title="Language Typing Assistance"
      onclick={() => ($typing_assistance_modal_opened = true)}
    >
      <Icon src={BiHelpCircle} class="mt-1 text-3xl text-sky-500 dark:text-sky-400" />
    </Button>
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
    <div class="space-y-2.5 sm:space-y-4">
      <AiImageGenerator />
    </div>
  {/if}
{/if}
