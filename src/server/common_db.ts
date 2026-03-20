// common db instantiations which both astro and sveltekit can use

import * as schema from '../db/schema';
import { drizzle as drizzle_neon } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { get_db_url } from '../db/db_utils';

const DB_URL = get_db_url(process.env);

const get_drizzle_instance_dev = async () => {
  const postgres = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  return drizzle(postgres.default(DB_URL), { schema });
};

export const db = import.meta.env.DEV
  ? await get_drizzle_instance_dev()
  : drizzle_neon(new Pool({ connectionString: DB_URL }), { schema });
