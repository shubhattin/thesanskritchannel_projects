import { db, type drizzleDbType } from '~/db/db';
import { redis } from '~/db/redis';
import { waitUntil } from '@vercel/functions';
import type { Redis } from '@upstash/redis/cloudflare';

export type defer_promise_type = (promise: Promise<unknown>) => void;

export type db_options = {
  defer?: defer_promise_type;
  db: drizzleDbType;
  redis: Redis;
};

/** App runtime cache/db bundle for shared server loaders. */
export const cache_db_options_app: db_options = {
  defer: waitUntil,
  db,
  redis
};
