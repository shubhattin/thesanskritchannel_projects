import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export function persistedStore<T>(key: string, initialValue: T): Writable<T> {
  const storedValue = browser ? localStorage.getItem(key) : null;
  const store = writable(storedValue ? JSON.parse(storedValue) : initialValue);

  store.subscribe((value) => {
    if (browser) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });

  return store;
}
