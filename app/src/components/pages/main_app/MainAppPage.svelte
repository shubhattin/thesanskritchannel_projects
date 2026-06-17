<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { onMount, untrack } from 'svelte';
  import { get, writable } from 'svelte/store';
  import { z } from 'zod';
  import { LanguageIcon, MultimediaIcon } from '~/components/icons';
  import {
    LANG_LIST,
    LANG_LIST_IDS,
    get_script_for_lang_id,
    get_translation_slot_label,
    lang_list_obj,
    SCRIPT_LIST,
    script_list_obj,
    type script_list_type
  } from '~/state/lang_list';
  import {
    project_state,
    editing_mode,
    viewing_script,
    selected_text_levels,
    BASE_SCRIPT,
    text_data_present,
    ai_tool_opened,
    selected_translation_lang_ids,
    edit_context_visible,
    edit_language_typer_status,
    sanskrit_mode,
    typing_assistance_modal_opened,
    get_active_translation_slot,
    is_editing_text,
    is_editing_translation,
    is_editing_translation_slot,
    image_tool_opened
  } from '~/state/main_app/state.svelte';
  import {
    get_list_length_for_last_param,
    get_list_name_at_depth_from_selected,
    get_map_list_at_depth,
    get_node_at_path,
    is_empty_list_branch,
    map_list_nodes_to_selector_options
  } from '~/state/project_list';
  import type { recursive_list_type } from '~/state/data_types';
  import { transliterate_custom } from '~/tools/converter';
  import { delay_dev } from '~/tools/delay';
  import Icon from '~/tools/Icon.svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import Display from './display/Display.svelte';
  import {
    active_langs_with_translations_q_options,
    prefetch_text_data,
    prefetch_translation_data,
    project_list_q_options,
    project_map_q_options,
    user_project_info_q_options
  } from '~/state/main_app/data.svelte';
  import { useSession } from '~/lib/auth-client';
  import { BiHelpCircle } from 'svelte-icons-pack/bi';
  import { Switch } from '$lib/components/ui/switch';
  import { BsKeyboard } from 'svelte-icons-pack/bs';
  import { loadLocalConfig } from './load_local_config';
  import AiImageGenerator from './ai_image_tool/AIImageGenerator.svelte';
  import { preloadScriptData, type ScriptLangType } from 'lipilekhika';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Select from '$lib/components/ui/select';
  import ProjectSettingsBar from './settings/ProjectSettingsBar.svelte';
  import TextLevelSelector from './TextLevelSelector.svelte';
  import EditListNameDialog, { type ListNameEditTarget } from './EditListNameDialog.svelte';
  import EditNameDevDialog, { type NameDevEditTarget } from './EditNameDevDialog.svelte';
  import LoadFromTextTool from './LoadFromTextTool.svelte';
  import { create_map_metadata_save_mutation } from './map_metadata_save';
  import Label from '~/lib/components/ui/label/label.svelte';
  import AITranslate from './display/ai_translate/AITranslate.svelte';
  import EditOptionsPopover from './display/EditOptionsPopover.svelte';

  let { path_params = [] }: { path_params?: number[] } = $props();

  let mounted = $state(false);
  onMount(async () => {
    if (import.meta.env.DEV) {
      (async () => {
        const conf = await loadLocalConfig();
        if (conf.trans_lang) {
          // 3 -> Hindi
          $selected_translation_lang_ids = [1, 3];
          $editing_mode = '2nd_lang';
        }
        if (conf.editing_status_on) $editing_mode = '2nd_lang';
        if (conf.image_tool_opened) $image_tool_opened = true;
        if (conf.ai_tool_opened) $ai_tool_opened = true;
      })();
    }
    await preloadScriptData(BASE_SCRIPT);
    mounted = true;
  });

  $effect(() => {
    // loading project map
    project_map_q.data;
  });

  const session = useSession();

  const project_list_q = createQuery(() => project_list_q_options());
  const project_map_q = createQuery(() => project_map_q_options($project_state));
  const user_project_info_q = createQuery(() =>
    user_project_info_q_options($session.data?.user?.id, $project_state)
  );
  const langs_with_translations_q = createQuery(() =>
    active_langs_with_translations_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present
    )
  );

  const levels = $derived($project_state?.levels ?? 0);
  const level_names = $derived($project_state?.level_names ?? []);
  const is_admin = $derived($session.data?.user.role === 'admin');
  const user_info = $derived($session.data?.user);
  const project_id = $derived($project_state?.project_id);

  const map_metadata_save_mut = create_map_metadata_save_mutation(
    () => get(project_state)?.project_id ?? undefined
  );

  let list_name_dialog_open = $state(false);
  let list_name_target = $state<ListNameEditTarget | null>(null);
  let name_dev_dialog_open = $state(false);
  let name_dev_target = $state<NameDevEditTarget | null>(null);
  let load_from_text_open = $state(false);

  function open_list_name_edit(map: recursive_list_type, path: number[], initial_value: string) {
    list_name_target = { path, initial_value, map };
    list_name_dialog_open = true;
  }

  function open_name_dev_edit(map: recursive_list_type, path: number[], initial_value: string) {
    name_dev_target = { path, initial_value, map };
    name_dev_dialog_open = true;
  }
  const active_leaf_state_index = $derived.by(() => {
    for (let i = 0; i < levels - 1; i++) {
      if ($selected_text_levels[i] != null) return i;
    }
    return 0;
  });
  const active_leaf_value = $derived($selected_text_levels[active_leaf_state_index] ?? null);

  type option_type = { text?: string; value?: number; empty_child?: boolean };

  const get_link = (project_key: string, path_params: (number | null | undefined)[]) => {
    let link = `/${project_key}`;
    for (const p of path_params) {
      if (!p) break;
      link += `/${p}`;
    }
    return link;
  };

  const get_path_params_from_selected = (selected: (number | null)[], project_levels: number) => {
    const params = selected.slice(0, project_levels - 1).reverse();
    while (params.length && params[params.length - 1] == null) params.pop();
    if (params.some((v) => v == null)) return [] as number[];
    return params as number[];
  };

  const derived_list_count = $derived.by(() => {
    if (!project_map_q.isSuccess) return null;
    const dynamic_path = get_path_params_from_selected($selected_text_levels, levels);
    if (dynamic_path.length === 0) return null;
    return get_list_length_for_last_param(project_map_q.data, dynamic_path);
  });

  const get_initial_option_for_state_index = (
    project_levels: number,
    state_index: number,
    map_root: recursive_list_type | false
  ) => {
    const depth_from_highest = project_levels - 2 - state_index;
    const value = path_params[depth_from_highest];
    let text: string | undefined;
    if (map_root && value) {
      const node = get_node_at_path(map_root, path_params.slice(0, depth_from_highest + 1));
      text = node?.name_dev;
    }
    return { value, text } satisfies option_type;
  };

  const prefetch_adjacent_text = (direction: 'prev' | 'next') => {
    if (!browser || !$text_data_present || !$project_state) return;
    const idx = active_leaf_state_index;
    const cur = $selected_text_levels[idx] ?? 1;
    const max = derived_list_count ?? cur;
    const next_value = direction === 'prev' ? Math.max(1, cur - 1) : Math.min(max, cur + 1);
    if (next_value === cur) return;
    const adjacent_levels = [...$selected_text_levels];
    adjacent_levels[idx] = next_value;
    prefetch_text_data(adjacent_levels, $project_state);
    for (const lang_id of $selected_translation_lang_ids) {
      if (lang_id !== null) prefetch_translation_data(adjacent_levels, $project_state, lang_id);
    }
  };

  $effect(() => {
    if (!browser) return;
    let link = window.location.pathname;
    const path_params = $selected_text_levels.slice(0, levels - 1).reverse(); // higher -> lower
    link = get_link($project_state!.project_key, path_params);
    if (window.location.pathname !== link) goto(link);
  });

  const params_viewing_script_mut_schema = z.object({
    script: z.string(),
    update_viewing_script_selection: z.boolean().default(true)
  });
  let viewing_script_selection = writable(BASE_SCRIPT);
  let viewing_script_mut = createMutation(() => ({
    mutationKey: ['viewing_script'],
    mutationFn: async (params: z.infer<typeof params_viewing_script_mut_schema>) => {
      // viewing script should not be directly changed as the resoucres for that
      // language/script might not be loaded yet
      const args = params_viewing_script_mut_schema.parse(params);
      const script = args.script as script_list_type;
      if (!mounted) return script;
      await delay_dev(350);
      await preloadScriptData(script);
      return script;
    },
    onSuccess(script, { update_viewing_script_selection }) {
      $viewing_script = script;
      if (update_viewing_script_selection) $viewing_script_selection = script;
    }
  }));
  $effect(() => {
    const next = $viewing_script_selection;
    if (next === get(viewing_script)) return;
    const _viewing_script_mut = untrack(() => viewing_script_mut);
    _viewing_script_mut.mutate({
      script: next,
      update_viewing_script_selection: false
    });
  });

  const set_translation_slot_lang = async (slot: 0 | 1, lang_id: number | null) => {
    const next = [...$selected_translation_lang_ids] as [number | null, number | null];
    next[slot] = lang_id;
    $selected_translation_lang_ids = next;

    const editing_translation = is_editing_translation($editing_mode);
    const active_slot = get_active_translation_slot($editing_mode);
    const is_active_edit_slot = active_slot === slot;
    // Other-slot changes during translation edit only affect Show context, not viewing script.
    if (editing_translation && !is_active_edit_slot) return;

    if (!mounted || !browser || lang_id === null || lang_id === lang_list_obj.English) return;
    await delay_dev(300);
    const script = get_script_for_lang_id(lang_id);
    if (script) {
      $viewing_script_selection = script;
    }
  };

  const active_translation_lang_id = $derived.by(() => {
    const slot = get_active_translation_slot($editing_mode);
    return slot === null ? null : $selected_translation_lang_ids[slot];
  });

  const can_edit_language = (lang_id: number | null) => {
    if (lang_id === null || !user_info) return false;
    if (user_info.role === 'admin') return true;
    if (!user_project_info_q.isSuccess) return false;
    return user_project_info_q.data.languages?.map((l) => l.lang_id).includes(lang_id) ?? false;
  };

  type lang_option = { lang: string; id: number };

  const set_edit_context_visible = (key: 'text' | 'lang_1' | 'lang_2', checked: boolean) => {
    $edit_context_visible = { ...$edit_context_visible, [key]: checked };
  };

  const get_grouped_lang_options = (
    other_lang_id: number | null,
    langs_with_translations: number[] | undefined
  ) => {
    const with_trans = new Set(langs_with_translations ?? []);
    const available: lang_option[] = [];
    const unavailable: lang_option[] = [];
    for (let i = 0; i < LANG_LIST.length; i++) {
      const id = LANG_LIST_IDS[i]!;
      if (id === other_lang_id) continue;
      const entry = { lang: LANG_LIST[i]!, id };
      if (with_trans.has(id)) available.push(entry);
      else unavailable.push(entry);
    }
    return { available, unavailable };
  };

  $effect(() => {
    if (
      active_translation_lang_id !== null &&
      active_translation_lang_id !== lang_list_obj.English &&
      is_editing_translation($editing_mode)
    ) {
      preloadScriptData(
        LANG_LIST[LANG_LIST_IDS.indexOf(active_translation_lang_id)] as ScriptLangType
      );
    }
  });

  // Language Typing for Schwa Deletion
  let sanskrit_mode_texts = createQuery(() => ({
    queryKey: ['sanskrit_mode_texts', active_translation_lang_id],
    enabled:
      browser &&
      is_editing_translation($editing_mode) &&
      active_translation_lang_id !== null &&
      active_translation_lang_id !== lang_list_obj.English,
    queryFn: () =>
      transliterate_custom(
        ['राम्', 'राम'],
        BASE_SCRIPT,
        LANG_LIST[LANG_LIST_IDS.indexOf(active_translation_lang_id!)] as ScriptLangType
      ),
    placeholderData: ['राम्', 'राम']
  }));
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
      if (
        !is_editing_translation($editing_mode) ||
        sanskrit_mode_texts.isFetching ||
        !sanskrit_mode_texts.isSuccess
      )
        return;
      if (
        active_translation_lang_id === null ||
        active_translation_lang_id === lang_list_obj.English
      )
        return;
      let schwa_deletion = false;
      if (
        SPECIFIC_SCHWA.scripts.includes(script_list_obj[$viewing_script]) ||
        SPECIFIC_SCHWA.langs.includes(active_translation_lang_id)
      ) {
        schwa_deletion = true;
      }
      $sanskrit_mode = !schwa_deletion ? 1 : 0; // no inherent vowel(schwa deletion) by default
    })();
  });
</script>

<ProjectSettingsBar />

<label class="block space-x-2 text-sm sm:space-x-2 sm:text-base">
  Script
  <Icon src={LanguageIcon} class="text-2xl sm:text-4xl" />
  <Select.Root
    type="single"
    bind:value={$viewing_script_selection as any}
    disabled={is_editing_text($editing_mode) ||
      ($viewing_script_selection !== BASE_SCRIPT && viewing_script_mut.isPending)}
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
  {@const map_root = project_map_q.isSuccess && project_map_q.data}
  {@const initial_option_base = get_initial_option_for_state_index(
    levels,
    text_level_state_index,
    map_root || false
  )}
  {@const fallback_level_name = level_names[levels - i - 1] ?? 'Level'}
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
  {@const initial_option_node =
    map_root && initial_option_base.value
      ? get_node_at_path(map_root, path_params.slice(0, i + 1) as number[])
      : null}
  {@const initial_option =
    map_root && i < levels - 2 && initial_option_base.value
      ? {
          ...initial_option_base,
          // Show the blocked icon only for list nodes that truly have no children.
          // Leaf nodes (e.g. info.type === 'shloka') are valid endpoints and should not be blocked.
          empty_child: initial_option_node ? is_empty_list_branch(initial_option_node) : false
        }
      : initial_option_base}
  {@const list_at_depth =
    map_root && get_map_list_at_depth(map_root, levels, $selected_text_levels, i)}
  {@const dynamic_path = get_path_params_from_selected($selected_text_levels, levels)}
  {@const list_name_path = dynamic_path.slice(0, i) as number[]}
  {@const list_name_node = map_root ? get_node_at_path(map_root, list_name_path) : null}
  {@const name_dev_path =
    map_root && dynamic_path.length > i ? (dynamic_path.slice(0, i + 1) as number[]) : null}
  {#if i === 0 || list_at_depth || initial_option.value}
    <TextLevelSelector
      name={level_name}
      {text_level_state_index}
      {initial_option}
      options={list_at_depth
        ? map_list_nodes_to_selector_options(list_at_depth, {
            mark_empty_child: i < levels - 2
          })
        : false}
      is_admin={is_admin && !!map_root}
      controls_disabled={$editing_mode !== 'none'}
      show_name_dev_edit={!!name_dev_path && name_dev_path.length > 0}
      on_edit_list_name={() => {
        if (!map_root || !list_name_node || list_name_node.info.type !== 'list') return;
        open_list_name_edit(map_root, list_name_path, list_name_node.info.list_name);
      }}
      on_edit_name_dev={() => {
        if (!map_root || !name_dev_path?.length) return;
        const node = get_node_at_path(map_root, name_dev_path);
        if (!node) return;
        open_name_dev_edit(map_root, name_dev_path, node.name_dev);
      }}
    />
  {/if}
{/each}

{#if project_id}
  <EditListNameDialog
    bind:open={list_name_dialog_open}
    bind:target={list_name_target}
    {project_id}
    save_mut={map_metadata_save_mut}
  />
  <EditNameDevDialog
    bind:open={name_dev_dialog_open}
    bind:target={name_dev_target}
    {project_id}
    save_mut={map_metadata_save_mut}
  />
{/if}

{#if $text_data_present}
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-1 sm:gap-3">
      {#if ($project_state?.levels ?? 0) > 1}
        {#if active_leaf_value !== 1}
          <Button
            onclick={() => {
              const idx = active_leaf_state_index;
              const cur = $selected_text_levels[idx] ?? 1;
              $selected_text_levels[idx] = Math.max(1, cur - 1);
            }}
            onmouseenter={() => prefetch_adjacent_text('prev')}
            variant="outline"
            size="sm"
            disabled={$editing_mode !== 'none'}
          >
            <Icon class="-mt-1 text-xl" src={TiArrowBackOutline} />
            Previous
          </Button>
        {/if}
        {#if active_leaf_value !== derived_list_count}
          <Button
            onclick={() => {
              const idx = active_leaf_state_index;
              const cur = $selected_text_levels[idx] ?? 1;
              const max = derived_list_count ?? cur;
              $selected_text_levels[idx] = Math.min(max, cur + 1);
            }}
            onmouseenter={() => prefetch_adjacent_text('next')}
            variant="outline"
            size="sm"
            disabled={$editing_mode !== 'none'}
          >
            Next
            <Icon class="-mt-1 text-xl" src={TiArrowForwardOutline} />
          </Button>
        {/if}
      {/if}
      {#if $editing_mode === 'none'}
        <EditOptionsPopover {is_admin} {can_edit_language} {viewing_script_selection} />
        {#if is_admin}
          <div class="ml-2 border-l pl-3">
            <Button
              onclick={() => (load_from_text_open = true)}
              variant="secondary"
              size="sm"
              class="border border-amber-500/40"
            >
              Load from Text
            </Button>
          </div>
        {/if}
      {/if}
      {#if !($ai_tool_opened && is_admin)}
        {#if is_admin}
          {@render btn_multi()}
        {/if}
      {/if}
    </div>
    {#if !($ai_tool_opened && is_admin)}
      <div class="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div class="grid max-w-md grid-cols-2 gap-x-4 gap-y-0.5">
          {#each [0, 1] as slot (slot)}
            <div class="text-xs text-muted-foreground">
              <span>Lang {slot + 1}</span>
            </div>
          {/each}
          {#each [0, 1] as slot (slot)}
            {@const slot_lang_id = $selected_translation_lang_ids[slot]}
            {@const other_lang_id = $selected_translation_lang_ids[slot === 0 ? 1 : 0]}
            {@const { available, unavailable } = get_grouped_lang_options(
              other_lang_id,
              langs_with_translations_q.data
            )}
            <Select.Root
              type="single"
              value={slot_lang_id === null ? 'none' : slot_lang_id.toString()}
              onValueChange={(v) => {
                set_translation_slot_lang(slot as 0 | 1, v === 'none' ? null : Number(v));
              }}
              disabled={is_editing_translation_slot($editing_mode, slot as 0 | 1)}
            >
              <Select.Trigger class="inline-flex h-7 w-full max-w-34 px-2 text-xs">
                {slot_lang_id === null ? 'None' : LANG_LIST[LANG_LIST_IDS.indexOf(slot_lang_id)]}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="none">None</Select.Item>
                {#if available.length > 0}
                  <Select.Group>
                    {#if unavailable.length > 0}
                      <Select.Label>Has translation</Select.Label>
                    {/if}
                    {#each available as { lang, id } (id)}
                      <Select.Item value={id.toString()}>{lang}</Select.Item>
                    {/each}
                  </Select.Group>
                {/if}
                {#if unavailable.length > 0}
                  <Select.Group>
                    <Select.Label>Translation not available</Select.Label>
                    {#each unavailable as { lang, id } (id)}
                      <Select.Item value={id.toString()}>{lang}</Select.Item>
                    {/each}
                  </Select.Group>
                {/if}
              </Select.Content>
            </Select.Root>
          {/each}
        </div>
        {#if $editing_mode !== 'none'}
          {@const show_text_checkbox = !is_editing_text($editing_mode)}
          {@const show_lang_1_checkbox =
            !is_editing_translation_slot($editing_mode, 0) &&
            $selected_translation_lang_ids[0] !== null}
          {@const show_lang_2_checkbox =
            !is_editing_translation_slot($editing_mode, 1) &&
            $selected_translation_lang_ids[1] !== null}
          {@const has_any_show_checkbox =
            show_text_checkbox || show_lang_1_checkbox || show_lang_2_checkbox}
          {#if has_any_show_checkbox || is_editing_translation($editing_mode)}
            <div
              class="flex flex-wrap items-center gap-x-3 gap-y-1 pb-0.5 text-xs text-muted-foreground"
            >
              {#if has_any_show_checkbox}
                <span class="font-medium">Show</span>
                {#if show_text_checkbox}
                  <label class="inline-flex cursor-pointer items-center gap-1.5">
                    <Checkbox
                      checked={$edit_context_visible.text}
                      onCheckedChange={(checked) =>
                        set_edit_context_visible('text', checked === true)}
                    />
                    Text
                  </label>
                {/if}
                {#if show_lang_1_checkbox}
                  <label
                    class="inline-flex cursor-pointer items-center gap-1.5 text-stone-500 dark:text-slate-400"
                  >
                    <Checkbox
                      checked={$edit_context_visible.lang_1}
                      onCheckedChange={(checked) =>
                        set_edit_context_visible('lang_1', checked === true)}
                    />
                    {get_translation_slot_label(0, $selected_translation_lang_ids)}
                  </label>
                {/if}
                {#if show_lang_2_checkbox}
                  <label
                    class="inline-flex cursor-pointer items-center gap-1.5 text-yellow-700 dark:text-yellow-500"
                  >
                    <Checkbox
                      checked={$edit_context_visible.lang_2}
                      onCheckedChange={(checked) =>
                        set_edit_context_visible('lang_2', checked === true)}
                    />
                    {get_translation_slot_label(1, $selected_translation_lang_ids)}
                  </label>
                {/if}
              {/if}
              {#if is_editing_translation($editing_mode)}
                <AITranslate />
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/if}
    {#snippet btn_multi()}
      {#await import('./multimedia/MultiMediaLinks.svelte')}
        <Button variant="ghost" class="h-auto flex-col gap-0.5 px-2 py-1 outline-none">
          <Icon src={MultimediaIcon} class="size-6 text-orange-600 sm:size-6 dark:text-amber-200" />
          <span class="text-[10px] font-medium text-muted-foreground">Media</span>
        </Button>
      {:then MultiMediaLinks}
        <MultiMediaLinks.default />
      {/await}
    {/snippet}
  </div>
{/if}
<LoadFromTextTool bind:open={load_from_text_open} />
{#if active_translation_lang_id !== null && active_translation_lang_id !== lang_list_obj.English && is_editing_translation($editing_mode) && !($ai_tool_opened && is_admin)}
  <div class="flex gap-2.5 sm:gap-4">
    <Label class="flex items-center gap-2">
      <Switch
        id="edit_lang"
        bind:checked={$edit_language_typer_status}
        class="focus:outline-none"
      />
      <Icon src={BsKeyboard} class="text-4xl" />
    </Label>
    {#if sanskrit_mode_texts.isSuccess && !sanskrit_mode_texts.isFetching}
      <Select.Root
        type="single"
        value={String($sanskrit_mode ?? 0)}
        onValueChange={(value) => {
          if (!value) return;
          $sanskrit_mode = Number(value);
        }}
        disabled={!$edit_language_typer_status}
      >
        <Select.Trigger class="w-28 text-sm">
          {$sanskrit_mode === 1
            ? 'rAm ➔ ' + sanskrit_mode_texts.data[0]
            : 'rAm ➔ ' + sanskrit_mode_texts.data[1]}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="1">rAm ➔ {sanskrit_mode_texts.data[0]}</Select.Item>
          <Select.Item value="0">rAm ➔ {sanskrit_mode_texts.data[1]}</Select.Item>
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
