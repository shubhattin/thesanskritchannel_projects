import { db } from '~/db/db';
import { redis } from '~/db/redis';
import type { db_options } from './cached_loader';
import { waitUntil } from '@vercel/functions';

/** App runtime cache/db bundle for shared server loaders. */
export const cache_db_options_app: db_options = {
  defer: waitUntil,
  db,
  redis
};
