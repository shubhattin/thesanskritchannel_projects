import { get, writable } from 'svelte/store';

/** True while text/translation editors have unsaved edits (blocks refresh/navigation). */
export let main_app_content_edit_dirty = writable(false);

/** True while an AI translation job is running (blocks refresh/navigation). */
export let main_app_ai_translate_in_progress = writable(false);

export function main_app_blocks_navigation() {
  return get(main_app_content_edit_dirty) || get(main_app_ai_translate_in_progress);
}
