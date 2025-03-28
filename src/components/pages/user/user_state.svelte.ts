import { writable } from 'svelte/store';

export let selected_user_id = writable<string | null>('');
export let selected_user_type = writable<'admin' | 'regular' | 'unapproved'>('regular');
