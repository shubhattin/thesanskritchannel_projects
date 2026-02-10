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
    get_list_name_at_depth_from_selected,
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
    path_params = [],
    path_names = []
  }: {
    path_params?: number[];
    path_names?: (string | undefined)[];
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

  const levels = $derived($project_state.levels);
  const level_names = $derived($project_state.level_names);

  type option_type = { text?: string; value?: number };

  const get_link = (project_key: project_keys_type, path_params: (number | null | undefined)[]) => {
    let link = `/${project_key}`;
    for (const p of path_params) {
      if (!p) break;
      link += `/${p}`;
    }
    return link;
  };

  const get_map_list_at_depth = (
    project_map: any,
    levels: number,
    selected: (number | null)[],
    depth: number
  ): any[] | null => {
    // depth: 0 -> root list (highest selector), 1 -> list under highest selection, etc.
    let node: any = project_map;
    for (let d = 0; d < depth; d++) {
      const sel = selected[levels - 2 - d];
      if (!sel) return null;
      if (node?.info?.type !== 'list') return null;
      const list: any[] = node.list ?? [];
      if (!(sel >= 1 && sel <= list.length)) return null;
      node = list[sel - 1];
      if (!node) return null;
    }
    if (node?.info?.type !== 'list') return null;
    return Array.isArray(node.list) ? node.list : null;
  };

  const get_initial_option_for_state_index = (levels: number, state_index: number) => {
    // state_index is lower->higher (0 is lowest route param, levels-2 is highest route param)
    const depth_from_highest = levels - 2 - state_index;
    return {
      value: path_params[depth_from_highest],
      text: path_names[depth_from_highest]
    } satisfies option_type;
  };

  $effect(() => {
    if (!browser) return;
    let link = window.location.pathname;
    const path_params = $selected_text_levels.slice(0, levels - 1).reverse(); // higher -> lower
    link = get_link($project_state.project_key!, path_params);
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

  const transliterate_selected_label = async (
    options: false | option_type[],
    initial_option: option_type,
    selected_value: number | null,
    script: script_list_type
  ) => {
    if (!selected_value) return 'Select';
    const selected_text = options
      ? (options.find((o) => o.value === selected_value)?.text ?? '')
      : (initial_option.text ?? '');
    if (!selected_text) return `${selected_value}.`;
    if (!browser || script === BASE_SCRIPT) return `${selected_value}. ${selected_text}`;
    const text_tr = await transliterate_custom(selected_text, BASE_SCRIPT, script);
    return `${selected_value}. ${text_tr}`;
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
{#each { length: levels - 1 } as _, i}
  {@const text_level_state_index = levels - i - 2}
  {@const initial_option = get_initial_option_for_state_index(levels, text_level_state_index)}
  {@const map_root = $project_map_q.isSuccess && $project_map_q.data}
  {@const fallback_level_name = level_names[levels - i - 1]}
  {@const level_name =
    map_root && levels > 0
      ? get_list_name_at_depth_from_selected(
          map_root,
          levels,
          $selected_text_levels,
          i,
          fallback_level_name
        )
      : fallback_level_name}
  {@const list_at_depth =
    map_root && get_map_list_at_depth(map_root, levels, $selected_text_levels, i)}
  {#if i === 0 || list_at_depth || initial_option.value}
    {@render selecter({
      name: level_name,
      text_level_state_index,
      initial_option,
      options: list_at_depth
        ? list_at_depth.map((text_level: any) => ({
            text: text_level.name_dev,
            value: text_level.pos
          }))
        : false
    })}
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
        const next_value = v ? parseInt(v) : null;
        $selected_text_levels[text_level_state_index] = next_value;
        // If a higher level changes, clear all dependent lower levels.
        for (let i = 0; i < text_level_state_index; i++) {
          $selected_text_levels[i] = null;
        }
      }}
      disabled={$editing_status_on}
    >
      <Select.Trigger
        class={`${get_text_font_class($viewing_script)} inline-flex h-10 w-44 px-2 py-1 sm:h-12 sm:w-52`}
      >
        {#await transliterate_selected_label(options, initial_option, $selected_text_levels[text_level_state_index], $viewing_script)}
          {$selected_text_levels[text_level_state_index]
            ? $selected_text_levels[text_level_state_index] + '. ' + initial_option.text
            : 'Select'}
        {:then label}
          {label}
        {/await}
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
          variant="outline"
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
          variant="outline"
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
          class="rounded-md bg-orange-500 px-1 py-0 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:ring-orange-500 dark:bg-orange-600 dark:hover:bg-orange-700 dark:focus-visible:ring-orange-600"
          size="sm"
        >
          View Translations
        </Button>
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
                variant="outline"
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
                variant="outline"
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
          <Icon src={MultimediaIcon} class="size-6 text-orange-600 sm:size-6 dark:text-amber-200" />
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
        value={$sanskrit_mode.toString()}
        onValueChange={(value) => {
          if (!value) return;
          $sanskrit_mode = Number(value);
        }}
        disabled={!$edit_language_typer_status}
      >
        <Select.Trigger class="w-28 text-sm">
          {$sanskrit_mode === 1
            ? 'rAm ➔ ' + $sanskrit_mode_texts.data[0]
            : 'rAm ➔ ' + $sanskrit_mode_texts.data[1]}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="1">rAm ➔ {$sanskrit_mode_texts.data[0]}</Select.Item>
          <Select.Item value="0">rAm ➔ {$sanskrit_mode_texts.data[1]}</Select.Item>
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
