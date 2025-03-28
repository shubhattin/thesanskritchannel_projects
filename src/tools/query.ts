import type { CreateQueryResult } from '@tanstack/svelte-query';
import type { Readable } from 'svelte/store';
import { derived } from 'svelte/store';

type StoresValues<T> =
  T extends Readable<infer U> ? U : { [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

/**
 * Get a derived store from a `svelte-query` function and a list of stores
 */
export const get_derived_query = <
  Stores extends Readable<any>[],
  Val,
  E,
  SvelteQuery extends CreateQueryResult<Val, E>
>(
  stores: [...Stores],
  query_func: (vals: StoresValues<Stores>) => SvelteQuery // Map stores to their inner values
) => {
  type result = StoresValues<SvelteQuery>;
  // OR
  // type result = Parameters<Parameters<SvelteQuery['subscribe']>[0]>[0];
  return derived(stores, (vals, set: (value: result) => void) => {
    const query = query_func(vals);
    const unsub = query.subscribe((state) => set(state as result));
    return () => {
      unsub();
    };
  });
};
