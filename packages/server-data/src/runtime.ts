import { Pool, neonConfig } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis/cloudflare';
import { drizzle as drizzle_neon } from 'drizzle-orm/neon-serverless';
import { get_db_url, type DbEnv } from '@tsc/db-schema/db-utils';
import * as schema from '@tsc/db-schema/schema';

export type RuntimeEnv = DbEnv & {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

export type CreateDbOptions = {
  isDev: boolean;
  webSocketConstructor?: unknown;
};

export const createDb = async (env: RuntimeEnv, options: CreateDbOptions) => {
  const dbUrl = get_db_url(env);
  if (options.webSocketConstructor) {
    neonConfig.webSocketConstructor = options.webSocketConstructor as never;
  }

  if (options.isDev) {
    // Dynamic import keeps postgres-js out of edge/serverless production bundles.
    const postgres = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    return drizzle(postgres.default(dbUrl), { schema });
  }

  return drizzle_neon(new Pool({ connectionString: dbUrl }), { schema });
};

export const createRedis = (env: RuntimeEnv) =>
  new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN
  });
