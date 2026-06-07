import type { db_options } from '@tsc/server-data/cached-loader';
import { waitUntil } from '@vercel/functions';
import { db, redis } from './site_db';

/** Site runtime cache/db bundle for shared server loaders. */
export const cache_db_options_site: db_options = {
  defer: waitUntil,
  db,
  redis,
  isProd: import.meta.env.PROD
};
