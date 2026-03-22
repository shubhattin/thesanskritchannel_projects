import dotenv from 'dotenv';
import * as schema from '../schema';
import { drizzle } from 'drizzle-orm/bun-sql';
import { dbMode } from '../../tools/kry.server';

dotenv.config({ path: '../../../.env' });

const DB_URL = {
  LOCAL: process.env.PG_DATABASE_URL!,
  PROD: process.env.PG_DATABASE_URL1!,
  PREVIEW: process.env.PG_DATABASE_URL2!
}[dbMode];

export const dbClient_ext = drizzle(DB_URL!, { schema });
