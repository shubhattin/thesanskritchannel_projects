import type { db_options } from '$app/utils/cache.server/cache_db_options.server';
import { waitUntil } from '@vercel/functions';
import { db, redis } from './site_db';

/** Site runtime cache/db bundle for shared server loaders. */
export const cache_db_options_site: db_options = {
  defer: waitUntil,
  db,
  redis
};
