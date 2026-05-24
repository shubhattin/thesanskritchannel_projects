import { writable } from 'svelte/store';
import { authClient } from '$lib/auth-client';

export const user_info = writable<(typeof authClient.$Infer.Session)['user'] | null | undefined>(
  null
);
