import type { project_keys_type } from '~/state/project_list';
import { derived, writable } from 'svelte/store';
import type { script_list_type } from '~/state/lang_list';

/**
 * This stores the info related to current selected text
 *
 * _level order_ : **lower -> higher** (eg. chapter, sarga-kanda)
 *
 * `index` is not part of this
 */
export let selected_text_levels = writable<(number | null)[]>([null, null]);
export let project_state = writable<{
  project_key: project_keys_type | null;
  project_id: number | null;
  levels: number;
}>({
  project_key: null,
  project_id: null,
  levels: 0
});
export let list_count = writable<number | null>(null);

export let text_data_present = derived(
  [project_state, selected_text_levels],
  ([$project_state, $selected_text_levels]) => {
    for (let i = 0; i < $project_state.levels - 1; i++) {
      if (!$selected_text_levels[i]) {
        return false;
      }
    }
    return true;
  }
);

export const BASE_SCRIPT = 'Devanagari';

export let viewing_script = writable<script_list_type>(BASE_SCRIPT);
export let trans_lang = writable<number>();
export let view_translation_status = writable(false);

// Edit
export let editing_status_on = writable(false);
export let sanskrit_mode = writable<number>();

export let added_translations_indexes = writable<number[]>([]);
export let edited_translations_indexes = writable<Set<number>>(new Set());
export let edit_language_typer_status = writable<boolean>(true);
export let typing_assistance_modal_opened = writable(false);

export let image_tool_opened = writable(false);
export let ai_tool_opened = writable(false);

// some values
export const TEXT_MODEL_LIST = {
  'gpt-4o': ['gpt 4o', '128K token context window\n$2.5/1M Input tokens & $10/1M Output tokens'],
  'o3-mini': [
    'o3 mini',
    '200K token context window\n$1.10/1M Input tokens & $4.40/1M Output tokens'
  ],
  'claude-3.7-sonnet': [
    'sonnet',
    '200K token context window\n$3/1M Input tokens & $15/1M Output tokens'
  ]
};
