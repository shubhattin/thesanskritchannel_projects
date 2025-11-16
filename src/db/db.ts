import { env } from '$env/dynamic/private';
import * as schema from './schema';
import { drizzle as drizzle_neon } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { get_db_url } from './db_utils';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { NeonQueryResultHKT } from 'drizzle-orm/neon-serverless';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

const DB_URL = get_db_url(env);

const get_drizzle_instance_dev = async () => {
  // using local postgres to allow edge environment in the edge
  const postgres = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  return drizzle(postgres.default(DB_URL), { schema });
};

export const db = import.meta.env.DEV
  ? await get_drizzle_instance_dev()
  : // using neon websocket adapter
    drizzle_neon(new Pool({ connectionString: DB_URL }), { schema });

export type transactionType =
  | PgTransaction<NeonQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  | typeof db;
