import { writable } from 'svelte/store';
import type { script_list_type } from '~/state/lang_list';
import type { ai_text_models_type } from '~/api/routes/ai/ai_types';

export type ProjectState = {
  project_key: string;
  project_id: number;
  listed: boolean;
  levels: number;
  level_names: string[];
};

/**
 * This stores the info related to current selected text
 *
 * _level order_ : **lower -> higher** (eg. chapter, sarga-kanda)
 *
 * `index` is not part of this
 */
export let selected_text_levels = writable<(number | null)[]>([null, null]);
export let project_state = writable<ProjectState | null>(null);
export let list_count = writable<number | null>(null);

/**
 * True when the current selection resolves to a leaf `shloka` node.
 *
 * NOTE: Projects (like Veda) can have varying subtree depths. So this value is
 * computed using the project map in `state/main_app/data.svelte.ts` and written here.
 */
export let text_data_present = writable(false);

export const BASE_SCRIPT = 'Devanagari';

export let viewing_script = writable<script_list_type>(BASE_SCRIPT);
export type translation_slot_mode = '1st_lang' | '2nd_lang';
export type dual_edit_mode = 'text_1st_lang' | 'text_2nd_lang';
export type editing_mode_type = 'none' | 'text' | translation_slot_mode | dual_edit_mode;
export let selected_translation_lang_ids = writable<[number | null, number | null]>([1, null]);
export let editing_mode = writable<editing_mode_type>('none');

export const is_editing_text = (mode: editing_mode_type) =>
  mode === 'text' || mode === 'text_1st_lang' || mode === 'text_2nd_lang';

export const is_editing_translation = (mode: editing_mode_type) =>
  mode === '1st_lang' ||
  mode === '2nd_lang' ||
  mode === 'text_1st_lang' ||
  mode === 'text_2nd_lang';

export const is_dual_edit_mode = (mode: editing_mode_type): mode is dual_edit_mode =>
  mode === 'text_1st_lang' || mode === 'text_2nd_lang';

export const get_active_translation_slot = (mode: editing_mode_type): 0 | 1 | null =>
  mode === '1st_lang' || mode === 'text_1st_lang'
    ? 0
    : mode === '2nd_lang' || mode === 'text_2nd_lang'
      ? 1
      : null;

export const is_editing_translation_slot = (mode: editing_mode_type, slot: 0 | 1) =>
  get_active_translation_slot(mode) === slot;

export type edit_context_panel_key = 'text' | 'lang_1' | 'lang_2';
export let edit_context_visible = writable<Record<edit_context_panel_key, boolean>>({
  text: true,
  lang_1: true,
  lang_2: false
});

// Legacy translation state retained until old auxiliary editors are removed.
export let trans_lang = writable<number>();

export let sanskrit_mode = writable(0);

export let added_translations_indexes = writable<number[]>([]);
export let edited_translations_indexes = writable<Set<number>>(new Set());
export let edit_language_typer_status = writable<boolean>(true);
export let typing_assistance_modal_opened = writable(false);

export let image_tool_opened = writable(false);
export let ai_tool_opened = writable(false);

// some values
export const TEXT_MODEL_LIST = {
  'gpt-5.2': ['gpt 5.2', '400K token context window\n$1.75/1M Input tokens & $14/1M Output tokens']
} satisfies Record<ai_text_models_type, [string, string]>;
