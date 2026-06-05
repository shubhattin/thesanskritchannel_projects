import { writable } from 'svelte/store';

/** True while text/translation editors have unsaved edits (blocks refresh/navigation). */
export let main_app_content_edit_dirty = writable(false);
