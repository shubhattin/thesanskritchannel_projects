import dotenv from 'dotenv';
import * as schema from '../schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { dbMode } from '../../tools/kry.server';
import postgres from 'postgres';

dotenv.config({ path: '../../../.env' });

const DB_URL = {
  LOCAL: process.env.PG_DATABASE_URL!,
  PROD: process.env.PG_DATABASE_URL1!,
  PREVIEW: process.env.PG_DATABASE_URL2!
}[dbMode];

export const query_client = postgres(DB_URL!);
export const dbClient_ext = drizzle(query_client, { schema });
