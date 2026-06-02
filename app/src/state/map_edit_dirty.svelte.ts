import { writable } from 'svelte/store';

/** True while the project map editor has unsaved edits (blocks project nav). */
export let map_edit_dirty = writable(false);
