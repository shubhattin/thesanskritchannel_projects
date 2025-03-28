import { browser } from '$app/environment';
import { QueryClient } from '@tanstack/svelte-query';
import ms from 'ms';

export const STALE_TIME = ms('6mins'); // by default data will stay fresh for 8 minutes

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      enabled: browser,
      staleTime: STALE_TIME
    }
  }
});
