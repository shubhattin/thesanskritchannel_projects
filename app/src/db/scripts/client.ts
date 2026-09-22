import dotenv from 'dotenv';
import * as schema from '../schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolveDbUrl } from '../../effect/config';
import { dbMode } from '../../tools/kry.server';

dotenv.config({ path: '../../../.env' });

/** `--prod` / `--preview` select the matching URL; otherwise the local URL. */
const DB_URL = resolveDbUrl({
  DB_MODE: dbMode === 'LOCAL' ? undefined : dbMode,
  PG_DATABASE_URL: process.env.PG_DATABASE_URL,
  PG_DATABASE_URL1: process.env.PG_DATABASE_URL1,
  PG_DATABASE_URL2: process.env.PG_DATABASE_URL2
});

if (!DB_URL) {
  throw new Error('Database URL is not configured for scripts (check DB_MODE / PG_DATABASE_URL*)');
}

export const query_client = postgres(DB_URL);
export const dbClient_ext = drizzle(query_client, { schema });
