import * as schema from '$app/db/schema';
import { drizzle as drizzle_neon } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { get_db_url } from '$app/db/db_utils';
import { Redis } from '@upstash/redis/cloudflare';

// `import.meta.env` is resolved at build time by Vite.
// On Vercel, runtime secrets are available in `process.env`,
// so we merge both to support local dev + prod serverless.
const env = { ...process.env, ...import.meta.env } as any;
const DB_URL = get_db_url(env);

const get_drizzle_instance_dev = async () => {
  const postgres = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  return drizzle(postgres.default(DB_URL), { schema });
};

export const db = import.meta.env.DEV
  ? await get_drizzle_instance_dev()
  : drizzle_neon(new Pool({ connectionString: DB_URL }), { schema });

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? import.meta.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? import.meta.env.UPSTASH_REDIS_REST_TOKEN
});
