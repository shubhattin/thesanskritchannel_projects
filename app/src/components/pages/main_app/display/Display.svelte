<script lang="ts">
  import { browser } from '$app/environment';
  import { beforeNavigate } from '$app/navigation';
  import { createMutation } from '@tanstack/svelte-query';
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import { ArrowDown, ArrowUp, GripVertical, Plus, Save, Trash2, Undo2, X } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { client } from '~/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    BASE_SCRIPT,
    edit_language_typer_status,
    editing_mode,
    project_state,
    sanskrit_mode,
    selected_text_levels,
    selected_translation_lang_ids,
    typing_assistance_modal_opened,
    view_translation_status,
    viewing_script
  } from '~/state/main_app/state.svelte';
  import {
    invalidate_project_content_queries,
    invalidate_project_map_queries,
    text_data_q,
    trans_slot_1_data_q,
    trans_slot_2_data_q
  } from '~/state/main_app/data.svelte';
  import { LANG_LIST, LANG_LIST_IDS, lang_list_obj, type lang_list_type } from '~/state/lang_list';
  import { transliterate_custom } from '~/tools/converter';
  import { get_font_family_and_size } from '~/tools/font_tools';
  import Icon from '~/tools/Icon.svelte';
  import { BsClipboard2Check } from 'svelte-icons-pack/bs';
  import { OiCopy16 } from 'svelte-icons-pack/oi';
  import { copy_text_to_clipboard } from '~/tools/kry';
  import * as Popover from '$lib/components/ui/popover';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import { main_app_content_edit_dirty } from '~/state/main_app_content_edit_dirty.svelte';

  type TextDraftRow = {
    client_id: string;
    source_index: number | null;
    text: string;
    shloka_type: boolean;
  };
  type TranslationDraftRow = {
    index: number;
    source_text: string;
    value: string;
    original: string | null;
  };

  const normalize_translation_value = (value: string | null) =>
    value === null || value === '' ? null : value;

  const clone_text_rows = (rows: TextDraftRow[]) => rows.map((row) => ({ ...row }));
  const clone_translation_rows = (rows: TranslationDraftRow[]) => rows.map((row) => ({ ...row }));

  let transliterated_data = $state<string[]>([]);
  let copied_text_status = $state(false);
  let text_portion_hovered = $state(false);
  let copy_btn_popup_state = $state(false);
  let text_rows = $state<TextDraftRow[]>([]);
  let text_baseline = $state<TextDraftRow[]>([]);
  let text_undo_stack = $state<TextDraftRow[][]>([]);
  let text_focus_group_open = $state(false);
  let text_drag_index = $state<number | null>(null);
  let text_session_key = $state('');
  let translation_rows = $state<TranslationDraftRow[]>([]);
  let translation_baseline = $state<TranslationDraftRow[]>([]);
  let translation_undo_stack = $state<TranslationDraftRow[][]>([]);
  let translation_focus_group_open = $state(false);
  let translation_session_key = $state('');

  const active_translation_slot = $derived(
    $editing_mode === '1st_lang' ? 0 : $editing_mode === '2nd_lang' ? 1 : null
  );
  const active_translation_lang_id = $derived(
    active_translation_slot === null
      ? null
      : $selected_translation_lang_ids[active_translation_slot]
  );
  const active_translation_query = $derived(
    active_translation_slot === 0 ? $trans_slot_1_data_q : $trans_slot_2_data_q
  );
  const active_translation_name = $derived(
    active_translation_lang_id === null
      ? ''
      : (LANG_LIST[LANG_LIST_IDS.indexOf(active_translation_lang_id)] as lang_list_type)
  );
  const main_text_font_info = $derived(get_font_family_and_size($viewing_script));
  const first_trans_font_info = $derived(
    get_font_family_and_size(
      (LANG_LIST[LANG_LIST_IDS.indexOf($selected_translation_lang_ids[0] ?? -1)] ??
        'English') as lang_list_type
    )
  );
  const second_trans_font_info = $derived(
    get_font_family_and_size(
      (LANG_LIST[LANG_LIST_IDS.indexOf($selected_translation_lang_ids[1] ?? -1)] ??
        'English') as lang_list_type
    )
  );
  const active_trans_font_info = $derived(
    get_font_family_and_size((active_translation_name || 'English') as lang_list_type)
  );
  const text_dirty = $derived(JSON.stringify(text_rows) !== JSON.stringify(text_baseline));
  const translation_dirty = $derived(
    translation_rows.some(
      (row) => normalize_translation_value(row.value) !== normalize_translation_value(row.original)
    )
  );
  /** Matches when the Save button in the editor toolbar would be enabled. */
  const editor_has_unsaved_changes = $derived.by(() => {
    if ($editing_mode === 'text') return text_dirty;
    if ($editing_mode === '1st_lang' || $editing_mode === '2nd_lang') return translation_dirty;
    return false;
  });
  const ctx = $derived(
    createTypingContext((active_translation_name || 'Devanagari') as lang_list_type, {
      includeInherentVowel: $sanskrit_mode !== 1
    })
  );

  $effect(() => {
    transliterate_custom(
      $text_data_q.data?.map((v) => v.text) ?? [],
      BASE_SCRIPT,
      $viewing_script
    ).then((data) => {
      transliterated_data = data;
    });
  });

  $effect(() => {
    if (copied_text_status) setTimeout(() => (copied_text_status = false), 1400);
  });

  $effect(() => {
    if ($editing_mode !== 'text' || !$text_data_q.isSuccess || !$text_data_q.data) {
      if ($editing_mode !== 'text') text_session_key = '';
      return;
    }
    const key = JSON.stringify($text_data_q.data);
    if (text_session_key === key) return;
    text_rows = $text_data_q.data.map((row) => ({
      client_id: crypto.randomUUID(),
      source_index: row.index,
      text: row.text,
      shloka_type: row.shloka_num !== null
    }));
    text_baseline = clone_text_rows(text_rows);
    text_undo_stack = [];
    text_session_key = key;
  });

  $effect(() => {
    if (
      !($editing_mode === '1st_lang' || $editing_mode === '2nd_lang') ||
      active_translation_lang_id === null ||
      !$text_data_q.isSuccess ||
      !active_translation_query.isSuccess
    ) {
      if (!($editing_mode === '1st_lang' || $editing_mode === '2nd_lang'))
        translation_session_key = '';
      return;
    }
    const key = `${$editing_mode}:${active_translation_lang_id}:${JSON.stringify($text_data_q.data)}:${JSON.stringify([...active_translation_query.data.entries()])}`;
    if (translation_session_key === key) return;
    translation_rows = ($text_data_q.data ?? []).map((row) => {
      const original = active_translation_query.data.get(row.index) ?? null;
      return {
        index: row.index,
        source_text: row.text,
        value: original ?? '',
        original
      };
    });
    translation_baseline = clone_translation_rows(translation_rows);
    translation_undo_stack = [];
    translation_session_key = key;
  });

  $effect(() => {
    ctx.ready;
  });

  $effect(() => {
    if (get(main_app_content_edit_dirty) !== editor_has_unsaved_changes) {
      main_app_content_edit_dirty.set(editor_has_unsaved_changes);
    }
  });

  let leave_confirmed = false;

  onMount(() => {
    if (!browser) return;

    const on_beforeunload = (e: BeforeUnloadEvent) => {
      if (!get(main_app_content_edit_dirty)) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', on_beforeunload);
    return () => window.removeEventListener('beforeunload', on_beforeunload);
  });

  beforeNavigate(({ cancel }) => {
    if (!get(main_app_content_edit_dirty) || leave_confirmed) return;
    const ok = confirm('You have unsaved text or translation edits. Leave and discard them?');
    if (!ok) cancel();
    else {
      leave_confirmed = true;
      queueMicrotask(() => {
        leave_confirmed = false;
      });
    }
  });

  onDestroy(() => {
    main_app_content_edit_dirty.set(false);
  });

  const copy_text = (text: string) => {
    copy_text_to_clipboard(text);
    copied_text_status = true;
  };

  const copy_sarga_shlokas_only = () => {
    copy_text(transliterated_data.join('\n\n'));
  };

  const copy_sarga_with_transliteration_and_translation = async () => {
    if (!$text_data_q.data) return;
    const normal_shlokas = await transliterate_custom(
      $text_data_q.data.map((d) => d.text),
      BASE_SCRIPT,
      'Normal'
    );
    const texts_to_copy = transliterated_data.map((shloka_lines, i) => {
      const parts = [`${shloka_lines}\n${normal_shlokas[i]}`];
      const first = $trans_slot_1_data_q.data?.get(i);
      const second = $trans_slot_2_data_q.data?.get(i);
      if (first) parts.push(first);
      if (second) parts.push(second);
      return parts.join('\n\n');
    });
    copy_text(texts_to_copy.join('\n\n\n'));
  };

  const close_editor = () => {
    $editing_mode = 'none';
  };

  const push_text_undo = () => {
    text_undo_stack = [...text_undo_stack, clone_text_rows(text_rows)];
  };

  const push_translation_undo = () => {
    translation_undo_stack = [...translation_undo_stack, clone_translation_rows(translation_rows)];
  };

  const update_text_row = (client_id: string, text: string) => {
    if (!text_focus_group_open) {
      push_text_undo();
      text_focus_group_open = true;
    }
    text_rows = text_rows.map((row) => (row.client_id === client_id ? { ...row, text } : row));
  };

  const update_translation_row = (index: number, value: string) => {
    if (!translation_focus_group_open) {
      push_translation_undo();
      translation_focus_group_open = true;
    }
    translation_rows = translation_rows.map((row) =>
      row.index === index ? { ...row, value } : row
    );
  };

  const undo_text = () => {
    const prev = text_undo_stack.at(-1);
    if (!prev) return;
    text_rows = clone_text_rows(prev);
    text_undo_stack = text_undo_stack.slice(0, -1);
  };

  const undo_translation = () => {
    const prev = translation_undo_stack.at(-1);
    if (!prev) return;
    translation_rows = clone_translation_rows(prev);
    translation_undo_stack = translation_undo_stack.slice(0, -1);
  };

  const add_text_row = (after_index: number) => {
    push_text_undo();
    const next = clone_text_rows(text_rows);
    next.splice(after_index + 1, 0, {
      client_id: crypto.randomUUID(),
      source_index: null,
      text: '',
      shloka_type: false
    });
    text_rows = next;
  };

  const delete_text_row = (client_id: string) => {
    push_text_undo();
    text_rows = text_rows.filter((row) => row.client_id !== client_id);
  };

  const move_text_row = (from: number, to: number) => {
    if (from === to || to < 0 || to >= text_rows.length) return;
    push_text_undo();
    const next = clone_text_rows(text_rows);
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    text_rows = next;
  };

  const save_text_mut = createMutation({
    mutationKey: ['text', 'save_text_rows'],
    mutationFn: async () =>
      client.text.save_text_rows.mutate({
        project_id: $project_state.project_id!,
        selected_text_levels: $selected_text_levels,
        rows: text_rows.map(({ source_index, text, shloka_type }) => ({
          source_index,
          text,
          shloka_type
        }))
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidate_project_content_queries($project_state.project_id ?? undefined),
        invalidate_project_map_queries($project_state.project_id ?? undefined)
      ]);
      toast.success('Text saved');
      close_editor();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save text');
    }
  });

  const save_translation_mut = createMutation({
    mutationKey: ['translation', 'save_slot_translation'],
    mutationFn: async () => {
      if (active_translation_lang_id === null) return { success: false };
      const changed = translation_rows.filter(
        (row) =>
          normalize_translation_value(row.value) !== normalize_translation_value(row.original)
      );
      return client.translation.edit_translation.mutate({
        project_id: $project_state.project_id!,
        lang_id: active_translation_lang_id,
        selected_text_levels: $selected_text_levels,
        indexes: changed.map((row) => row.index),
        data: changed.map((row) => (row.value === '' ? null : row.value))
      });
    },
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error('Permission denied for this language');
        return;
      }
      await invalidate_project_content_queries($project_state.project_id ?? undefined);
      toast.success('Translation saved');
      close_editor();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save translation');
    }
  });

  const detect_shortcut_pressed = (event: KeyboardEvent) => {
    if (event.altKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      $edit_language_typer_status = !$edit_language_typer_status;
    }
  };
</script>

{#if copied_text_status}
  <div
    class="fixed right-2 bottom-2 z-50 cursor-default font-bold text-green-700 select-none dark:text-green-300"
  >
    <Icon src={BsClipboard2Check} />
    Copied to Clipboard
  </div>
{/if}

{#if $editing_mode === 'text'}
  {@render text_editor()}
{:else if $editing_mode === '1st_lang' || $editing_mode === '2nd_lang'}
  {@render translation_editor()}
{:else}
  {@render readonly_display()}
{/if}

{#if $typing_assistance_modal_opened && active_translation_lang_id !== null}
  {#await import('~/components/TypingAssistance.svelte') then TypingAssistance}
    <TypingAssistance.default
      sync_lang_script={LANG_LIST[LANG_LIST_IDS.indexOf(active_translation_lang_id)]}
      bind:modal_opened={$typing_assistance_modal_opened}
    />
  {/await}
{/if}

{#snippet readonly_display()}
  <div class="relative w-full">
    <Popover.Root bind:open={copy_btn_popup_state}>
      <Popover.Trigger class="absolute top-2 right-5 z-20 p-0 outline-none select-none">
        {#if text_portion_hovered}
          <span transition:fade={{ duration: 150 }} title="Copy Chapter Text">
            <Icon src={OiCopy16} class="text-lg" />
          </span>
        {/if}
      </Popover.Trigger>
      <Popover.Content side="bottom" align="end" class="w-auto p-1">
        <div class="flex flex-col gap-1">
          <button
            onclick={copy_sarga_shlokas_only}
            class="block w-full rounded-md px-2 py-1 text-sm hover:bg-muted"
          >
            Copy Shlokas
          </button>
          <button
            onclick={copy_sarga_with_transliteration_and_translation}
            class="block w-full rounded-md px-2 py-1 text-xs hover:bg-muted"
          >
            Copy Shlokas with Translation
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="h-[95vh] overflow-scroll rounded-xl border-2 border-gray-400 p-0 dark:border-gray-600"
    onmouseenter={() => (text_portion_hovered = true)}
    onmouseleave={() => {
      if (!copy_btn_popup_state) text_portion_hovered = false;
    }}
  >
    {#if !$text_data_q.data}
      <Skeleton class="m-2 h-[80vh] w-[calc(100%-1rem)] rounded-lg" />
    {:else if $text_data_q.isSuccess && $text_data_q.data}
      <div transition:fade={{ duration: 250 }} class="flex flex-col gap-[0.15rem]">
        {#each transliterated_data as shloka_lines, i (i)}
          {@const is_spacing_allowed =
            ['bhagavadgita'].includes($project_state.project_key!) &&
            i > 2 &&
            i < transliterated_data.length - 2}
          <div class="rounded-lg px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-800">
            <div class="flex gap-2">
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
              <div class="mt-0 flex w-full flex-col gap-1">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  style:font-size={`${main_text_font_info.size}rem`}
                  style:font-family={main_text_font_info.family}
                  ondblclick={() => copy_text(shloka_lines)}
                >
                  {#each shloka_lines.split('\n') as line_shlk, line_index (line_index)}
                    <div>{line_shlk}</div>
                  {/each}
                </div>
                {@render translation_display_line(i, 0)}
                {@render translation_display_line(i, 1)}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet translation_display_line(i: number, slot: 0 | 1)}
  {@const query = slot === 0 ? $trans_slot_1_data_q : $trans_slot_2_data_q}
  {@const font_info = slot === 0 ? first_trans_font_info : second_trans_font_info}
  {#if $view_translation_status && query.isSuccess && query.data?.has(i)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      ondblclick={() => copy_text(query.data.get(i)!)}
      class={slot === 0
        ? 'text-stone-500 dark:text-slate-400'
        : 'text-yellow-700 dark:text-yellow-500'}
      style:font-size={`${font_info.size}rem`}
      style:font-family={font_info.family}
    >
      {#each query.data.get(i)?.split('\n') ?? [] as line_trans, line_index (line_index)}
        {#if line_trans !== ''}
          <div>{line_trans}</div>
        {/if}
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet editor_toolbar(kind: 'text' | 'translation')}
  <div
    class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 p-2 backdrop-blur"
  >
    <div class="font-semibold">
      {kind === 'text' ? 'Edit Text' : `Edit ${active_translation_name} Translation`}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={kind === 'text' ? undo_text : undo_translation}
        disabled={kind === 'text'
          ? text_undo_stack.length === 0
          : translation_undo_stack.length === 0}
      >
        <Undo2 data-icon="inline-start" />
        Undo
      </Button>
      <Button variant="outline" size="sm" onclick={close_editor}>
        <X data-icon="inline-start" />
        Cancel
      </Button>
      <Button
        size="sm"
        onclick={() => (kind === 'text' ? $save_text_mut.mutate() : $save_translation_mut.mutate())}
        disabled={!editor_has_unsaved_changes ||
          (kind === 'text' ? $save_text_mut.isPending : $save_translation_mut.isPending)}
      >
        <Save data-icon="inline-start" />
        {kind === 'text'
          ? $save_text_mut.isPending
            ? 'Saving...'
            : 'Save'
          : $save_translation_mut.isPending
            ? 'Saving...'
            : 'Save'}
      </Button>
    </div>
  </div>
{/snippet}

{#snippet text_editor()}
  <div class="flex h-screen flex-col gap-3">
    {@render editor_toolbar('text')}
    {#if !$text_data_q.isSuccess}
      <Skeleton class="h-[80vh] w-full rounded-lg" />
    {:else}
      <div class="flex flex-col gap-2 overflow-scroll rounded-xl border p-2">
        {#each text_rows as row, i (row.client_id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="rounded-lg border bg-card p-2"
            draggable="true"
            ondragstart={() => (text_drag_index = i)}
            ondragover={(e) => e.preventDefault()}
            ondrop={() => {
              if (text_drag_index !== null) move_text_row(text_drag_index, i);
              text_drag_index = null;
            }}
          >
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <GripVertical class="text-muted-foreground" />
              <span class="text-xs text-muted-foreground">Index {i}</span>
              <label class="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={row.shloka_type}
                  onCheckedChange={(checked) => {
                    push_text_undo();
                    text_rows = text_rows.map((candidate) =>
                      candidate.client_id === row.client_id
                        ? { ...candidate, shloka_type: checked === true }
                        : candidate
                    );
                  }}
                />
                Shloka
              </label>
              <Button
                variant="outline"
                size="sm"
                onclick={() => move_text_row(i, i - 1)}
                disabled={i === 0}
              >
                <ArrowUp data-icon="inline-start" />
                Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                onclick={() => move_text_row(i, i + 1)}
                disabled={i === text_rows.length - 1}
              >
                <ArrowDown data-icon="inline-start" />
                Down
              </Button>
              <Button variant="outline" size="sm" onclick={() => add_text_row(i)}>
                <Plus data-icon="inline-start" />
                Add
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onclick={() => delete_text_row(row.client_id)}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </div>
            <Textarea
              value={row.text}
              onfocus={() => (text_focus_group_open = false)}
              onblur={() => (text_focus_group_open = false)}
              oninput={(e) => update_text_row(row.client_id, e.currentTarget.value)}
              class="min-h-24 w-full"
              style={`font-size: ${main_text_font_info.size}rem; font-family: ${main_text_font_info.family};`}
            />
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet translation_editor()}
  <div class="flex h-screen flex-col gap-3">
    {@render editor_toolbar('translation')}
    {#if !active_translation_query.isSuccess || !$text_data_q.isSuccess}
      <Skeleton class="h-[80vh] w-full rounded-lg" />
    {:else}
      <div class="flex flex-col gap-2 overflow-scroll rounded-xl border p-2">
        {#each translation_rows as row (row.index)}
          <div class="rounded-lg border bg-card p-2">
            <div class="mb-2">
              <span class="text-xs text-muted-foreground">Index {row.index}</span>
            </div>
            <div class="mb-2 text-sm text-muted-foreground">{row.source_text}</div>
            <Textarea
              value={row.value}
              placeholder="Leave empty to remove translation on save"
              onfocus={() => (translation_focus_group_open = false)}
              oninput={(e) => update_translation_row(row.index, e.currentTarget.value)}
              onbeforeinput={(e) =>
                handleTypingBeforeInputEvent(
                  ctx,
                  e,
                  (newValue) => update_translation_row(row.index, newValue),
                  $edit_language_typer_status &&
                    active_translation_lang_id !== lang_list_obj.English
                )}
              onblur={() => {
                translation_focus_group_open = false;
                ctx.clearContext();
              }}
              onkeydown={(e) => clearTypingContextOnKeyDown(e, ctx)}
              onkeyup={detect_shortcut_pressed}
              class="min-h-24 w-full"
              style={`font-size: ${active_trans_font_info.size}rem; font-family: ${active_trans_font_info.family};`}
            />
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
