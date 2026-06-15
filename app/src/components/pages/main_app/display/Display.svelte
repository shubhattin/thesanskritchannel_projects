<script lang="ts">
  import { browser } from '$app/environment';
  import { beforeNavigate } from '$app/navigation';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import {
    ArrowDown,
    ArrowUp,
    GripVertical,
    Loader2,
    Plus,
    Save,
    Trash2,
    Undo2,
    X
  } from '@lucide/svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { toast } from 'svelte-sonner';
  import { client } from '~/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    BASE_SCRIPT,
    edit_context_visible,
    edit_language_typer_status,
    editing_mode,
    get_active_translation_slot,
    is_dual_edit_mode,
    is_editing_text,
    is_editing_translation,
    is_editing_translation_slot,
    project_state,
    sanskrit_mode,
    selected_text_levels,
    selected_translation_lang_ids,
    typing_assistance_modal_opened,
    viewing_script,
    text_data_present
  } from '~/state/main_app/state.svelte';
  import {
    active_text_data_q_options,
    build_content_session_scope,
    get_trans_slot_data_query_keys,
    invalidate_project_content_queries,
    invalidate_project_map_queries,
    trans_slot_data_q_options
  } from '~/state/main_app/data.svelte';
  import { LANG_LIST, LANG_LIST_IDS, lang_list_obj, type lang_list_type } from '~/state/lang_list';
  import { transliterate_custom } from '~/tools/converter';
  import { get_font_family_and_size } from '~/tools/font_tools';
  import Icon from '~/tools/Icon.svelte';
  import { BsClipboard2Check, BsKeyboard } from 'svelte-icons-pack/bs';
  import { OiCopy16 } from 'svelte-icons-pack/oi';
  import { copy_text_to_clipboard } from '~/tools/kry';
  import * as Popover from '$lib/components/ui/popover';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import {
    main_app_ai_translate_in_progress,
    main_app_blocks_navigation,
    main_app_content_edit_dirty
  } from '~/state/main_app_content_edit_dirty.svelte';
  import { cn } from '$lib/utils';
  import Label from '~/lib/components/ui/label/label.svelte';
  import {
    apply_single_normalization_to_texts,
    get_normalization_options,
    type NormalizationKey
  } from '~/tools/text_normalizations';

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
    shloka_num: number | null;
  };
  type DualUndoSnapshot = { text: TextDraftRow[]; translation: TranslationDraftRow[] };

  const normalize_translation_value = (value: string | null) =>
    value === null || value === '' ? null : value;

  const query_client = useQueryClient();

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

  const clone_text_rows = (rows: TextDraftRow[]) => rows.map((row) => ({ ...row }));
  const text_normalization_options = get_normalization_options();
  const clone_translation_rows = (rows: TranslationDraftRow[]) => rows.map((row) => ({ ...row }));

  let transliterated_data = $state<string[]>([]);
  let copied_text_status = $state(false);
  let text_portion_hovered = $state(false);
  let copy_btn_popup_state = $state(false);
  let text_rows = $state<TextDraftRow[]>([]);
  let text_baseline = $state<TextDraftRow[]>([]);
  let text_undo_stack = $state<TextDraftRow[][]>([]);
  let text_focus_group_open = $state(false);
  let text_actions_popover_open = $state(false);
  let text_drag_index = $state<number | null>(null);
  let text_drop_index = $state<number | null>(null);
  let text_session_key = $state('');
  let translation_rows = $state<TranslationDraftRow[]>([]);
  let translation_baseline = $state<TranslationDraftRow[]>([]);
  let translation_undo_stack = $state<TranslationDraftRow[][]>([]);
  let dual_undo_stack = $state<DualUndoSnapshot[]>([]);
  let translation_focus_group_open = $state(false);
  let translation_session_key = $state('');
  let last_ai_query_revision = $state('');
  let edit_text_typer_status = $state(true);
  let initial_row_count = $state(1);
  let translation_save_use_positional = $state(false);
  let dual_save_in_progress = $state(false);

  const active_translation_slot = $derived(get_active_translation_slot($editing_mode));
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
  const derived_shloka_nums = $derived.by(() => {
    let shloka_num = 0;
    return text_rows.map((row) => {
      if (!row.shloka_type) return null;
      shloka_num++;
      return shloka_num;
    });
  });
  const text_dirty = $derived(JSON.stringify(text_rows) !== JSON.stringify(text_baseline));
  const translation_dirty = $derived.by(() => {
    if (is_dual_edit_mode($editing_mode) && translation_rows.length !== text_rows.length) {
      return true;
    }
    return translation_rows.some(
      (row) => normalize_translation_value(row.value) !== normalize_translation_value(row.original)
    );
  });
  /** Matches when the Save button in the editor toolbar would be enabled. */
  const editor_has_unsaved_changes = $derived.by(() => {
    if (is_dual_edit_mode($editing_mode)) return text_dirty || translation_dirty;
    if ($editing_mode === 'text') return text_dirty;
    if (is_editing_translation($editing_mode)) return translation_dirty;
    return false;
  });
  const text_typing_enabled = $derived($viewing_script === BASE_SCRIPT);
  const translation_typing_ctx = $derived(
    createTypingContext((active_translation_name || 'Devanagari') as lang_list_type, {
      includeInherentVowel: $sanskrit_mode !== 1
    })
  );
  const text_typing_ctx = $derived(
    createTypingContext('Devanagari' as lang_list_type, {
      includeInherentVowel: true
    })
  );

  const editor_font_style = (font_info: { size: number; family: string }) =>
    `font-size: ${font_info.size}rem; font-family: ${font_info.family};`;

  const empty_translation_row = (
    textRow: TextDraftRow,
    shloka_num: number | null
  ): TranslationDraftRow => ({
    index: textRow.source_index ?? -1,
    source_text: textRow.text,
    value: '',
    original: null,
    shloka_num
  });

  const build_translation_rows_from_text_rows = (): TranslationDraftRow[] => {
    const query_data = active_translation_query.data;
    let shloka_num = 0;
    return text_rows.map((textRow) => {
      const is_shloka = textRow.shloka_type;
      if (is_shloka) shloka_num++;
      const idx = textRow.source_index;
      const original = idx !== null && query_data ? (query_data.get(idx) ?? null) : null;
      return {
        index: idx ?? -1,
        source_text: textRow.text,
        value: original ?? '',
        original,
        shloka_num: is_shloka ? shloka_num : null
      };
    });
  };

  const hydrate_dual_translation_rows = () => {
    translation_rows = build_translation_rows_from_text_rows();
    translation_baseline = clone_translation_rows(translation_rows);
    translation_undo_stack = [];
    dual_undo_stack = [];
    translation_focus_group_open = false;
    if (active_translation_query.data) {
      last_ai_query_revision = JSON.stringify([...active_translation_query.data.entries()]);
    }
  };

  $effect(() => {
    transliterate_custom(
      text_data_q.data?.map((v) => v.text) ?? [],
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
    if (!is_editing_text($editing_mode) || !text_data_q.isSuccess || !text_data_q.data) {
      if (!is_editing_text($editing_mode)) text_session_key = '';
      return;
    }
    const key = `${build_content_session_scope($project_state!.project_id, $selected_text_levels, $project_state!.levels)}:${$editing_mode}:${JSON.stringify(text_data_q.data)}`;
    if (text_session_key === key) return;
    text_rows = text_data_q.data.map((row) => ({
      client_id: crypto.randomUUID(),
      source_index: row.index,
      text: row.text,
      shloka_type: row.shloka_num !== null
    }));
    text_baseline = clone_text_rows(text_rows);
    text_undo_stack = [];
    dual_undo_stack = [];
    text_session_key = key;

    if (
      is_dual_edit_mode($editing_mode) &&
      active_translation_lang_id !== null &&
      active_translation_query.isSuccess
    ) {
      hydrate_dual_translation_rows();
      translation_session_key = key;
    }
  });

  $effect(() => {
    if (
      !is_editing_translation($editing_mode) ||
      is_dual_edit_mode($editing_mode) ||
      active_translation_lang_id === null ||
      !text_data_q.isSuccess ||
      !active_translation_query.isSuccess
    ) {
      if (!is_editing_translation($editing_mode)) {
        translation_session_key = '';
      }
      return;
    }
    const key = `${build_content_session_scope($project_state!.project_id, $selected_text_levels, $project_state!.levels)}:${$editing_mode}:${active_translation_lang_id}:${JSON.stringify(text_data_q.data)}`;
    if (translation_session_key === key) return;
    translation_rows = (text_data_q.data ?? []).map((row) => {
      const original = active_translation_query.data.get(row.index) ?? null;
      return {
        index: row.index,
        source_text: row.text,
        value: original ?? '',
        original,
        shloka_num: row.shloka_num
      };
    });
    translation_baseline = clone_translation_rows(translation_rows);
    translation_undo_stack = [];
    translation_focus_group_open = false;
    translation_session_key = key;
    last_ai_query_revision = JSON.stringify([...active_translation_query.data.entries()]);
  });

  $effect(() => {
    if (
      !is_dual_edit_mode($editing_mode) ||
      text_session_key === '' ||
      translation_session_key !== '' ||
      active_translation_lang_id === null ||
      !active_translation_query.isSuccess ||
      text_rows.length === 0
    ) {
      return;
    }
    hydrate_dual_translation_rows();
    translation_session_key = text_session_key;
  });

  $effect(() => {
    if (
      !is_editing_translation($editing_mode) ||
      active_translation_lang_id === null ||
      !active_translation_query.isSuccess ||
      !active_translation_query.data ||
      !translation_session_key
    )
      return;

    const query_data = active_translation_query.data;
    const query_revision = JSON.stringify([...query_data.entries()]);
    if (query_revision === last_ai_query_revision) return;

    untrack(() => {
      const ai_merges: { index: number; value: string }[] = [];

      for (const row of translation_rows) {
        const from_query = row.index >= 0 ? query_data.get(row.index) : undefined;
        if (!from_query || from_query === row.value) continue;
        ai_merges.push({ index: row.index, value: from_query });
      }

      if (ai_merges.length > 0) {
        if (is_dual_edit_mode($editing_mode)) {
          push_dual_undo();
        } else {
          translation_undo_stack = [
            ...translation_undo_stack,
            clone_translation_rows(translation_rows)
          ];
        }
        translation_rows = translation_rows.map((row) => {
          const merge = ai_merges.find((entry) => entry.index === row.index);
          return merge ? { ...row, value: merge.value } : row;
        });
        translation_focus_group_open = false;
      }

      last_ai_query_revision = query_revision;
    });
  });

  $effect(() => {
    translation_typing_ctx.ready;
    text_typing_ctx.ready;
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
      if (!main_app_blocks_navigation()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', on_beforeunload);
    return () => window.removeEventListener('beforeunload', on_beforeunload);
  });

  beforeNavigate(({ cancel }) => {
    if (!main_app_blocks_navigation() || leave_confirmed) return;
    const dirty = get(main_app_content_edit_dirty);
    const ai_translating = get(main_app_ai_translate_in_progress);
    const message =
      dirty && ai_translating
        ? 'You have unsaved edits and an AI translation in progress. Leave anyway?'
        : ai_translating
          ? 'AI translation is in progress. Leave and discard it?'
          : 'You have unsaved text or translation edits. Leave and discard them?';
    const ok = confirm(message);
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
    if (!text_data_q.data) return;
    const normal_shlokas = await transliterate_custom(
      text_data_q.data.map((d) => d.text),
      BASE_SCRIPT,
      'Normal'
    );
    const texts_to_copy = transliterated_data.map((shloka_lines, i) => {
      const parts = [`${shloka_lines}\n${normal_shlokas[i]}`];
      const persisted_index = text_data_q.data[i]?.index;
      const first =
        persisted_index === undefined ? undefined : trans_slot_1_data_q.data?.get(persisted_index);
      const second =
        persisted_index === undefined ? undefined : trans_slot_2_data_q.data?.get(persisted_index);
      if (first) parts.push(first);
      if (second) parts.push(second);
      return parts.join('\n\n');
    });
    copy_text(texts_to_copy.join('\n\n\n'));
  };

  let discard_dialog_open = $state(false);
  let save_dialog_open = $state(false);
  let pending_save_kind = $state<'text' | 'translation' | 'dual' | null>(null);

  const close_editor = () => {
    $editing_mode = 'none';
  };

  const discard_active_translation_cache = async () => {
    const slot = active_translation_slot;
    if (slot === null) return;

    const restored = new Map<number, string>();
    for (const row of translation_baseline) {
      if (row.original !== null) restored.set(row.index, row.original);
    }

    query_client.setQueryData(trans_slot_data_query_key[slot], restored);
    await invalidate_project_content_queries($project_state?.project_id ?? undefined);
  };

  const request_close_editor = () => {
    if (editor_has_unsaved_changes) {
      discard_dialog_open = true;
      return;
    }
    close_editor();
  };

  const confirm_discard = async () => {
    const mode = get(editing_mode);
    discard_dialog_open = false;
    if (is_dual_edit_mode(mode)) {
      text_rows = clone_text_rows(text_baseline);
      translation_rows = clone_translation_rows(translation_baseline);
      await discard_active_translation_cache();
    } else if (is_editing_translation(mode)) {
      await discard_active_translation_cache();
    }
    close_editor();
  };

  const request_save = (kind: 'text' | 'translation' | 'dual') => {
    pending_save_kind = kind;
    save_dialog_open = true;
  };

  const push_text_undo = () => {
    text_undo_stack = [...text_undo_stack, clone_text_rows(text_rows)];
  };

  const push_translation_undo = () => {
    translation_undo_stack = [...translation_undo_stack, clone_translation_rows(translation_rows)];
  };

  const push_dual_undo = () => {
    dual_undo_stack = [
      ...dual_undo_stack,
      {
        text: clone_text_rows(text_rows),
        translation: clone_translation_rows(translation_rows)
      }
    ];
  };

  const push_undo_for_text_mutation = () => {
    if (is_dual_edit_mode(get(editing_mode))) push_dual_undo();
    else push_text_undo();
  };

  const update_text_row = (client_id: string, text: string) => {
    if (!text_focus_group_open) {
      push_undo_for_text_mutation();
      text_focus_group_open = true;
    }
    const row_index = text_rows.findIndex((row) => row.client_id === client_id);
    text_rows = text_rows.map((row) => (row.client_id === client_id ? { ...row, text } : row));
    if (is_dual_edit_mode(get(editing_mode)) && row_index >= 0) {
      translation_rows = translation_rows.map((row, i) =>
        i === row_index ? { ...row, source_text: text } : row
      );
    }
  };

  const update_translation_row = (index: number, value: string) => {
    if (!translation_focus_group_open) {
      if (is_dual_edit_mode(get(editing_mode))) push_dual_undo();
      else push_translation_undo();
      translation_focus_group_open = true;
    }
    translation_rows = translation_rows.map((row) =>
      row.index === index ? { ...row, value } : row
    );
  };

  const update_translation_row_at = (position: number, value: string) => {
    if (!translation_focus_group_open) {
      push_dual_undo();
      translation_focus_group_open = true;
    }
    translation_rows = translation_rows.map((row, i) => (i === position ? { ...row, value } : row));
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

  const undo_dual = () => {
    const prev = dual_undo_stack.at(-1);
    if (!prev) return;
    text_rows = clone_text_rows(prev.text);
    translation_rows = clone_translation_rows(prev.translation);
    dual_undo_stack = dual_undo_stack.slice(0, -1);
  };

  const add_text_row = (after_index: number) => {
    push_undo_for_text_mutation();
    const next = clone_text_rows(text_rows);
    const new_text_row: TextDraftRow = {
      client_id: crypto.randomUUID(),
      source_index: null,
      text: '',
      shloka_type: false
    };
    next.splice(after_index + 1, 0, new_text_row);
    text_rows = next;
    if (is_dual_edit_mode(get(editing_mode))) {
      const next_trans = clone_translation_rows(translation_rows);
      next_trans.splice(after_index + 1, 0, empty_translation_row(new_text_row, null));
      translation_rows = next_trans;
    }
  };

  const add_initial_text_rows = async () => {
    const count = Math.max(1, Math.floor(Number(initial_row_count)) || 1);
    push_undo_for_text_mutation();
    const new_rows = Array.from({ length: count }, () => ({
      client_id: crypto.randomUUID(),
      source_index: null,
      text: '',
      shloka_type: false
    }));
    text_rows = new_rows;
    if (is_dual_edit_mode(get(editing_mode))) {
      translation_rows = new_rows.map((row) => empty_translation_row(row, null));
    }
    text_focus_group_open = false;
    initial_row_count = 1;
    await focus_text_row_at(0);
  };

  const delete_text_row = (client_id: string) => {
    const row_index = text_rows.findIndex((row) => row.client_id === client_id);
    push_undo_for_text_mutation();
    text_rows = text_rows.filter((row) => row.client_id !== client_id);
    if (is_dual_edit_mode(get(editing_mode)) && row_index >= 0) {
      translation_rows = translation_rows.filter((_, i) => i !== row_index);
    }
  };

  const apply_text_normalization = (key: NormalizationKey) => {
    if (text_rows.length === 0) return;
    push_undo_for_text_mutation();
    const text_indices = text_rows.map((_, index) => index);
    const updated_texts = apply_single_normalization_to_texts(
      text_rows.map((row) => row.text),
      text_indices,
      key
    );
    text_rows = text_rows.map((row, index) => ({
      ...row,
      text: updated_texts[index] ?? row.text
    }));
    if (is_dual_edit_mode(get(editing_mode))) {
      translation_rows = translation_rows.map((row, index) => ({
        ...row,
        source_text: updated_texts[index] ?? row.source_text
      }));
    }
    text_focus_group_open = false;
    text_actions_popover_open = false;
  };

  const move_translation_row = (from: number, to: number) => {
    const next = clone_translation_rows(translation_rows);
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    translation_rows = next;
  };

  const move_text_row = (from: number, to: number) => {
    if (from === to || to < 0 || to >= text_rows.length) return false;
    push_undo_for_text_mutation();
    const next = clone_text_rows(text_rows);
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    text_rows = next;
    if (is_dual_edit_mode(get(editing_mode))) {
      move_translation_row(from, to);
    }
    return true;
  };

  const focus_text_row_at = async (index: number) => {
    await tick();
    const card = document.querySelector(`[data-text-row-index="${index}"]`);
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    (card?.querySelector('textarea') as HTMLTextAreaElement | null)?.focus();
  };

  const move_text_row_and_focus = async (from: number, to: number) => {
    if (!move_text_row(from, to)) return;
    await focus_text_row_at(to);
  };

  const start_text_row_drag = (index: number, event: DragEvent) => {
    text_drag_index = index;
    const transfer = event.dataTransfer;
    if (!transfer) return;
    transfer.effectAllowed = 'move';
    transfer.setData('text/plain', String(index));
    const card = (event.currentTarget as HTMLElement).closest('[data-text-row-card]');
    if (card instanceof HTMLElement) {
      transfer.setDragImage(card, 24, 24);
    }
  };

  const end_text_row_drag = () => {
    text_drag_index = null;
    text_drop_index = null;
  };

  const on_text_row_dragover = (index: number, event: DragEvent) => {
    event.preventDefault();
    if (text_drag_index === null || text_drag_index === index) return;
    text_drop_index = index;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };

  const on_text_row_dragleave = (index: number, event: DragEvent) => {
    const current_target = event.currentTarget;
    if (!(current_target instanceof HTMLElement)) return;
    const related = event.relatedTarget;
    if (related instanceof Node && current_target.contains(related)) return;
    if (text_drop_index === index) text_drop_index = null;
  };

  const on_text_row_drop = async (index: number, event: DragEvent) => {
    event.preventDefault();
    const from = text_drag_index;
    const moved = from !== null && move_text_row(from, index);
    end_text_row_drag();
    if (moved) await focus_text_row_at(index);
  };

  const save_text_mut = createMutation(() => ({
    mutationKey: ['text', 'save_text_rows'],
    mutationFn: async () =>
      client.text.save_text_rows.mutate({
        project_id: $project_state!.project_id,
        selected_text_levels: $selected_text_levels,
        rows: text_rows.map(({ source_index, text, shloka_type }) => ({
          source_index,
          text,
          shloka_type
        }))
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidate_project_content_queries($project_state?.project_id ?? undefined),
        invalidate_project_map_queries($project_state?.project_id ?? undefined)
      ]);
      if (!dual_save_in_progress) {
        save_dialog_open = false;
        toast.success('Text saved');
        close_editor();
      }
    },
    onError: (err) => {
      dual_save_in_progress = false;
      toast.error(err.message || 'Failed to save text');
    }
  }));

  const build_translation_save_payload = () => {
    const changed: { index: number; value: string }[] = [];
    for (let i = 0; i < translation_rows.length; i++) {
      const row = translation_rows[i]!;
      if (normalize_translation_value(row.value) === normalize_translation_value(row.original)) {
        continue;
      }
      const index = translation_save_use_positional
        ? i
        : is_dual_edit_mode(get(editing_mode))
          ? (text_rows[i]?.source_index ?? row.index)
          : row.index;
      if (index < 0) continue;
      changed.push({ index, value: row.value });
    }
    return changed;
  };

  const save_translation_mut = createMutation(() => ({
    mutationKey: ['translation', 'save_slot_translation'],
    mutationFn: async () => {
      if (active_translation_lang_id === null) return { success: false };
      const changed = build_translation_save_payload();
      if (changed.length === 0) return { success: true };
      return client.translation.edit_translation.mutate({
        project_id: $project_state!.project_id,
        lang_id: active_translation_lang_id,
        selected_text_levels: $selected_text_levels,
        indexes: changed.map((row) => row.index),
        data: changed.map((row) => (row.value === '' ? null : row.value))
      });
    },
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error('Permission denied for this language');
        save_dialog_open = false;
        dual_save_in_progress = false;
        return;
      }
      await invalidate_project_content_queries($project_state?.project_id ?? undefined);
      if (!dual_save_in_progress) {
        save_dialog_open = false;
        toast.success('Translation saved');
        close_editor();
      }
    },
    onError: (err) => {
      dual_save_in_progress = false;
      toast.error(err.message || 'Failed to save translation');
    }
  }));

  const save_pending = $derived(save_text_mut.isPending || save_translation_mut.isPending);
  const save_confirm_description = $derived(
    pending_save_kind === 'text'
      ? 'Your text edits will be saved to the server.'
      : pending_save_kind === 'translation'
        ? `Your ${active_translation_name} translation edits will be saved to the server.`
        : pending_save_kind === 'dual'
          ? `Your text and ${active_translation_name} translation edits will be saved to the server.`
          : ''
  );

  const confirm_save = async () => {
    if (pending_save_kind === 'text') {
      save_text_mut.mutate();
      return;
    }
    if (pending_save_kind === 'translation') {
      translation_save_use_positional = false;
      save_translation_mut.mutate();
      return;
    }
    if (pending_save_kind !== 'dual') return;

    const was_text_dirty = text_dirty;
    const was_translation_dirty = translation_dirty;
    dual_save_in_progress = true;
    try {
      if (was_text_dirty) {
        translation_save_use_positional = true;
        await save_text_mut.mutateAsync();
      } else {
        translation_save_use_positional = false;
      }
      if (was_translation_dirty) {
        await save_translation_mut.mutateAsync();
      }
      save_dialog_open = false;
      if (was_text_dirty && was_translation_dirty) {
        toast.success('Text and translation saved');
      } else if (was_text_dirty) {
        toast.success('Text saved');
      } else {
        toast.success('Translation saved');
      }
      close_editor();
    } catch {
      // Error toasts handled in mutation onError
    } finally {
      dual_save_in_progress = false;
      translation_save_use_positional = false;
    }
  };

  $effect(() => {
    if (!save_dialog_open) pending_save_kind = null;
  });

  const detect_shortcut_pressed = (event: KeyboardEvent) => {
    if (event.altKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      if (is_editing_text(get(editing_mode)) && !is_dual_edit_mode(get(editing_mode))) {
        if (text_typing_enabled) edit_text_typer_status = !edit_text_typer_status;
      } else if (is_editing_translation(get(editing_mode))) {
        $edit_language_typer_status = !$edit_language_typer_status;
      }
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

{#if is_dual_edit_mode($editing_mode)}
  {@render dual_editor()}
{:else if $editing_mode === 'text'}
  {@render text_editor()}
{:else if is_editing_translation($editing_mode)}
  {@render translation_editor()}
{:else}
  {@render readonly_display()}
{/if}

{#if $editing_mode !== 'none'}
  <AlertDialog.Root bind:open={discard_dialog_open}>
    <AlertDialog.Content class="max-w-md">
      <AlertDialog.Header>
        <AlertDialog.Title>Discard unsaved edits?</AlertDialog.Title>
        <AlertDialog.Description class="text-sm text-muted-foreground">
          You have unsaved changes. Discard them and leave the editor?
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
        <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
        <Button variant="destructive" onclick={confirm_discard}>Discard</Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>

  <AlertDialog.Root bind:open={save_dialog_open}>
    <AlertDialog.Content class="max-w-md">
      <AlertDialog.Header>
        <AlertDialog.Title>Save changes?</AlertDialog.Title>
        <AlertDialog.Description class="text-sm text-muted-foreground">
          {save_confirm_description}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
        <AlertDialog.Cancel disabled={save_pending}>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action disabled={save_pending} onclick={confirm_save}>
          {#if save_pending}
            <Loader2 class="size-4 animate-spin" />
          {/if}
          Save
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
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
    class="h-[110vh] overflow-scroll rounded-xl border-2 border-gray-400 p-0 dark:border-gray-600"
    onmouseenter={() => (text_portion_hovered = true)}
    onmouseleave={() => {
      if (!copy_btn_popup_state) text_portion_hovered = false;
    }}
  >
    {#if !text_data_q.data}
      <Skeleton class="m-2 h-[80vh] w-[calc(100%-1rem)] rounded-lg" />
    {:else if text_data_q.isSuccess && text_data_q.data}
      <div transition:fade={{ duration: 250 }} class="flex flex-col gap-[0.15rem]">
        {#each transliterated_data as shloka_lines, i (i)}
          {@const is_spacing_allowed =
            ['bhagavadgita'].includes($project_state!.project_key) &&
            i > 2 &&
            i < transliterated_data.length - 2}
          <div class="rounded-lg px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-800">
            <div class="flex gap-2">
              {#if text_data_q.data[i]?.shloka_num || is_spacing_allowed}
                <div
                  class="flex items-center align-top text-[0.75rem] leading-6 text-gray-500 select-none dark:text-gray-300"
                >
                  {#if text_data_q.data[i]?.shloka_num}
                    {text_data_q.data[i].shloka_num}
                  {:else if is_spacing_allowed}
                    <span class="inline-block w-11"></span>
                  {/if}
                </div>
              {/if}
              <div class="mt-0 flex w-full flex-col gap-1">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div ondblclick={() => copy_text(shloka_lines)}>
                  {@render multiline_display(shloka_lines, main_text_font_info)}
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

{#snippet multiline_display(
  text: string,
  font_info: { size: number; family: string },
  class_name = ''
)}
  <div
    class={class_name}
    style:font-size={`${font_info.size}rem`}
    style:font-family={font_info.family}
  >
    {#each text.split('\n') as line, line_index (line_index)}
      <div>{line}</div>
    {/each}
  </div>
{/snippet}

{#snippet edit_row_index_badge(index: number, shloka_num: number | null)}
  <span class="absolute top-2 right-2 text-xs text-muted-foreground tabular-nums select-none"
    >{index}{#if shloka_num !== null}
      - {shloka_num}{/if}</span
  >
{/snippet}

{#snippet edit_context_translation_line(data_index: number | null, slot: 0 | 1)}
  {@const query = slot === 0 ? trans_slot_1_data_q : trans_slot_2_data_q}
  {@const font_info = slot === 0 ? first_trans_font_info : second_trans_font_info}
  {#if data_index !== null && query.isSuccess && query.data?.has(data_index)}
    <div
      class={slot === 0
        ? 'text-stone-500 dark:text-slate-400'
        : 'text-yellow-700 dark:text-yellow-500'}
    >
      {@render multiline_display(query.data.get(data_index)!, font_info, 'text-sm')}
    </div>
  {/if}
{/snippet}

{#snippet edit_context_text_panel(data_index: number, fallback_text: string)}
  {#if !is_editing_text($editing_mode) && $edit_context_visible.text}
    {@const display_text = transliterated_data[data_index] ?? fallback_text}
    <div class="mb-2">
      {@render multiline_display(display_text, main_text_font_info, 'text-sm')}
    </div>
  {/if}
{/snippet}

{#snippet edit_context_translation_panels_below(data_index: number | null)}
  {@const show_lang_1 =
    !is_editing_translation_slot($editing_mode, 0) &&
    $edit_context_visible.lang_1 &&
    $selected_translation_lang_ids[0] !== null}
  {@const show_lang_2 =
    !is_editing_translation_slot($editing_mode, 1) &&
    $edit_context_visible.lang_2 &&
    $selected_translation_lang_ids[1] !== null}
  {#if show_lang_1 || show_lang_2}
    <div class="mt-2 flex flex-col gap-1.5 border-t border-border/60 pt-2">
      {#if show_lang_1}
        {@render edit_context_translation_line(data_index, 0)}
      {/if}
      {#if show_lang_2}
        {@render edit_context_translation_line(data_index, 1)}
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet translation_display_line(i: number, slot: 0 | 1)}
  {@const persisted_index = text_data_q.data?.[i]?.index}
  {@const query = slot === 0 ? trans_slot_1_data_q : trans_slot_2_data_q}
  {@const font_info = slot === 0 ? first_trans_font_info : second_trans_font_info}
  {#if persisted_index !== undefined && query.isSuccess && query.data?.has(persisted_index)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      ondblclick={() => copy_text(query.data.get(persisted_index)!)}
      class={slot === 0
        ? 'text-stone-500 dark:text-slate-400'
        : 'text-yellow-700 dark:text-yellow-500'}
    >
      {@render multiline_display(query.data.get(persisted_index)!, font_info)}
    </div>
  {/if}
{/snippet}

{#snippet editor_toolbar(kind: 'text' | 'translation' | 'dual')}
  <div
    class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 p-2 backdrop-blur"
  >
    <div class="font-semibold">
      {kind === 'text'
        ? 'Edit Text'
        : kind === 'dual'
          ? `Edit Text + ${active_translation_name}`
          : `Edit ${active_translation_name} Translation`}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if kind === 'text' || kind === 'dual'}
        <Popover.Root bind:open={text_actions_popover_open}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="outline" size="sm" disabled={text_rows.length === 0}>
                Text Actions
              </Button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content align="start" class="w-[min(36rem,92vw)] p-1">
            <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {#each text_normalization_options as option (option.key)}
                <button
                  type="button"
                  class="rounded-sm border border-border bg-background px-2.5 py-1.5 text-left text-xs leading-snug transition-colors hover:bg-muted"
                  onclick={() => apply_text_normalization(option.key)}
                >
                  {option.description}
                </button>
              {/each}
            </div>
          </Popover.Content>
        </Popover.Root>
      {/if}
      <Button
        variant="outline"
        size="sm"
        onclick={kind === 'dual' ? undo_dual : kind === 'text' ? undo_text : undo_translation}
        disabled={kind === 'dual'
          ? dual_undo_stack.length === 0
          : kind === 'text'
            ? text_undo_stack.length === 0
            : translation_undo_stack.length === 0}
      >
        <Undo2 data-icon="inline-start" />
        Undo
      </Button>
      <Button variant="outline" size="sm" onclick={request_close_editor}>
        <X data-icon="inline-start" />
        Cancel
      </Button>
      <Button
        size="sm"
        onclick={() => request_save(kind === 'dual' ? 'dual' : kind)}
        disabled={!editor_has_unsaved_changes || save_pending}
      >
        <Save data-icon="inline-start" />
        {save_pending ? 'Saving...' : 'Save'}
      </Button>
    </div>
  </div>
{/snippet}

{#snippet text_editor()}
  <div class="flex h-screen flex-col gap-3">
    {@render editor_toolbar('text')}
    {#if text_typing_enabled}
      <div class="flex flex-wrap items-center gap-2 px-1">
        <Label>
          <Switch
            id="edit_text_typer"
            bind:checked={edit_text_typer_status}
            class="focus:outline-none"
          />
          <Icon src={BsKeyboard} class="text-3xl" />
        </Label>
        <span class="text-xs text-muted-foreground">
          Use <span class="font-semibold">Alt+x</span> to toggle typing
        </span>
      </div>
    {/if}
    {#if !text_data_q.isSuccess}
      <Skeleton class="h-[80vh] w-full rounded-lg" />
    {:else}
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border p-2">
        {#if text_rows.length === 0}
          <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p class="text-sm text-muted-foreground">This list has no shlokas yet.</p>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <Label for="initial-row-count" class="text-sm">Rows to add</Label>
              <Input
                id="initial-row-count"
                type="number"
                min="1"
                class="h-9 w-20"
                bind:value={initial_row_count}
              />
              <Button size="sm" onclick={add_initial_text_rows}>
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </div>
          </div>
        {:else}
          {#each text_rows as row, i (row.client_id)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              data-text-row-card
              data-text-row-index={i}
              class={cn(
                'relative rounded-lg border bg-card p-2 pt-8 transition-[opacity,box-shadow,transform]',
                text_drag_index === i && 'scale-[0.99] opacity-45',
                text_drop_index === i &&
                  text_drag_index !== null &&
                  text_drag_index !== i &&
                  'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}
              ondragover={(e) => on_text_row_dragover(i, e)}
              ondragleave={(e) => on_text_row_dragleave(i, e)}
              ondrop={(e) => on_text_row_drop(i, e)}
            >
              {@render edit_row_index_badge(i, derived_shloka_nums[i])}
              <div class="mb-2 flex flex-wrap items-center gap-2 pr-14">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  role="button"
                  tabindex="0"
                  draggable="true"
                  class="cursor-grab touch-none rounded p-0.5 text-muted-foreground select-none hover:bg-muted active:cursor-grabbing"
                  aria-label="Drag to reorder"
                  ondragstart={(e) => start_text_row_drag(i, e)}
                  ondragend={end_text_row_drag}
                >
                  <GripVertical />
                </div>
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
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  aria-label="Move up"
                  onclick={() => move_text_row_and_focus(i, i - 1)}
                  disabled={i === 0}
                >
                  <ArrowUp class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  aria-label="Move down"
                  onclick={() => move_text_row_and_focus(i, i + 1)}
                  disabled={i === text_rows.length - 1}
                >
                  <ArrowDown class="size-4" />
                </Button>
                <Button variant="outline" size="sm" onclick={() => add_text_row(i)}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-destructive hover:text-destructive"
                  aria-label="Delete row"
                  onclick={() => delete_text_row(row.client_id)}
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
              <Textarea
                value={row.text}
                onfocus={() => (text_focus_group_open = false)}
                onblur={() => {
                  text_focus_group_open = false;
                  text_typing_ctx.clearContext();
                }}
                oninput={(e) => update_text_row(row.client_id, e.currentTarget.value)}
                onbeforeinput={(e) =>
                  handleTypingBeforeInputEvent(
                    text_typing_ctx,
                    e,
                    (newValue) => update_text_row(row.client_id, newValue),
                    text_typing_enabled && edit_text_typer_status
                  )}
                onkeydown={(e) => clearTypingContextOnKeyDown(e, text_typing_ctx)}
                onkeyup={detect_shortcut_pressed}
                class="min-h-28 w-full whitespace-pre-wrap"
                style={editor_font_style(main_text_font_info)}
              />
              {@render edit_context_translation_panels_below(row.source_index)}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet dual_editor()}
  <div class="flex h-screen flex-col gap-3">
    {@render editor_toolbar('dual')}
    {#if text_typing_enabled}
      <div class="flex flex-wrap items-center gap-2 px-1">
        <Label>
          <Switch
            id="edit_text_typer_dual"
            bind:checked={edit_text_typer_status}
            class="focus:outline-none"
          />
          <Icon src={BsKeyboard} class="text-3xl" />
        </Label>
        <span class="text-xs text-muted-foreground">Text typing (Devanagari)</span>
      </div>
    {/if}
    {#if !text_data_q.isSuccess || !active_translation_query.isSuccess}
      <Skeleton class="h-[80vh] w-full rounded-lg" />
    {:else}
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border p-2">
        {#if text_rows.length === 0}
          <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p class="text-sm text-muted-foreground">This list has no shlokas yet.</p>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <Label for="dual-initial-row-count" class="text-sm">Rows to add</Label>
              <Input
                id="dual-initial-row-count"
                type="number"
                min="1"
                class="h-9 w-20"
                bind:value={initial_row_count}
              />
              <Button size="sm" onclick={add_initial_text_rows}>
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </div>
          </div>
        {:else}
          {#each text_rows as row, i (row.client_id)}
            {@const trans_row = translation_rows[i]}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              data-text-row-card
              data-text-row-index={i}
              class={cn(
                'relative rounded-lg border bg-card p-2 pt-8 transition-[opacity,box-shadow,transform]',
                text_drag_index === i && 'scale-[0.99] opacity-45',
                text_drop_index === i &&
                  text_drag_index !== null &&
                  text_drag_index !== i &&
                  'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}
              ondragover={(e) => on_text_row_dragover(i, e)}
              ondragleave={(e) => on_text_row_dragleave(i, e)}
              ondrop={(e) => on_text_row_drop(i, e)}
            >
              {@render edit_row_index_badge(i, derived_shloka_nums[i])}
              <div class="mb-2 flex flex-wrap items-center gap-2 pr-14">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  role="button"
                  tabindex="0"
                  draggable="true"
                  class="cursor-grab touch-none rounded p-0.5 text-muted-foreground select-none hover:bg-muted active:cursor-grabbing"
                  aria-label="Drag to reorder"
                  ondragstart={(e) => start_text_row_drag(i, e)}
                  ondragend={end_text_row_drag}
                >
                  <GripVertical />
                </div>
                <label class="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={row.shloka_type}
                    onCheckedChange={(checked) => {
                      push_dual_undo();
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
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  aria-label="Move up"
                  onclick={() => move_text_row_and_focus(i, i - 1)}
                  disabled={i === 0}
                >
                  <ArrowUp class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  aria-label="Move down"
                  onclick={() => move_text_row_and_focus(i, i + 1)}
                  disabled={i === text_rows.length - 1}
                >
                  <ArrowDown class="size-4" />
                </Button>
                <Button variant="outline" size="sm" onclick={() => add_text_row(i)}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-destructive hover:text-destructive"
                  aria-label="Delete row"
                  onclick={() => delete_text_row(row.client_id)}
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
              <Textarea
                value={row.text}
                onfocus={() => (text_focus_group_open = false)}
                onblur={() => {
                  text_focus_group_open = false;
                  text_typing_ctx.clearContext();
                }}
                oninput={(e) => update_text_row(row.client_id, e.currentTarget.value)}
                onbeforeinput={(e) =>
                  handleTypingBeforeInputEvent(
                    text_typing_ctx,
                    e,
                    (newValue) => update_text_row(row.client_id, newValue),
                    text_typing_enabled && edit_text_typer_status
                  )}
                onkeydown={(e) => clearTypingContextOnKeyDown(e, text_typing_ctx)}
                onkeyup={detect_shortcut_pressed}
                class="min-h-28 w-full whitespace-pre-wrap"
                style={editor_font_style(main_text_font_info)}
              />
              {#if trans_row}
                <div class="mt-2 border-t border-border/60 pt-2">
                  <p class="mb-1 text-xs text-muted-foreground">{active_translation_name}</p>
                  <Textarea
                    value={trans_row.value}
                    placeholder="Leave empty to remove translation on save"
                    onfocus={() => (translation_focus_group_open = false)}
                    oninput={(e) => update_translation_row_at(i, e.currentTarget.value)}
                    onbeforeinput={(e) =>
                      handleTypingBeforeInputEvent(
                        translation_typing_ctx,
                        e,
                        (newValue) => update_translation_row_at(i, newValue),
                        $edit_language_typer_status &&
                          active_translation_lang_id !== lang_list_obj.English
                      )}
                    onblur={() => {
                      translation_focus_group_open = false;
                      translation_typing_ctx.clearContext();
                    }}
                    onkeydown={(e) => clearTypingContextOnKeyDown(e, translation_typing_ctx)}
                    onkeyup={detect_shortcut_pressed}
                    class="min-h-28 w-full whitespace-pre-wrap"
                    style={editor_font_style(active_trans_font_info)}
                  />
                </div>
              {/if}
              {@render edit_context_translation_panels_below(row.source_index)}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet translation_editor()}
  <div class="flex h-screen flex-col gap-3">
    {@render editor_toolbar('translation')}
    {#if !active_translation_query.isSuccess || !text_data_q.isSuccess}
      <Skeleton class="h-[80vh] w-full rounded-lg" />
    {:else}
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border p-2">
        {#each translation_rows as row (row.index)}
          <div class="relative rounded-lg border bg-card p-2 pt-8">
            {@render edit_row_index_badge(row.index, row.shloka_num)}
            {@render edit_context_text_panel(row.index, row.source_text)}
            <Textarea
              value={row.value}
              placeholder="Leave empty to remove translation on save"
              onfocus={() => (translation_focus_group_open = false)}
              oninput={(e) => update_translation_row(row.index, e.currentTarget.value)}
              onbeforeinput={(e) =>
                handleTypingBeforeInputEvent(
                  translation_typing_ctx,
                  e,
                  (newValue) => update_translation_row(row.index, newValue),
                  $edit_language_typer_status &&
                    active_translation_lang_id !== lang_list_obj.English
                )}
              onblur={() => {
                translation_focus_group_open = false;
                translation_typing_ctx.clearContext();
              }}
              onkeydown={(e) => clearTypingContextOnKeyDown(e, translation_typing_ctx)}
              onkeyup={detect_shortcut_pressed}
              class="min-h-36 w-full whitespace-pre-wrap"
              style={editor_font_style(active_trans_font_info)}
            />
            {@render edit_context_translation_panels_below(row.index)}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
