import { writable } from 'svelte/store';
import { authClient } from '$lib/auth-client';

export const user_info = writable<(typeof authClient.$Infer.Session)['user'] | null | undefined>(
  null
);
export const is_current_app_scope = writable<boolean>(false);
