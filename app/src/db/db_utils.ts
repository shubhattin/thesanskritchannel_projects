import { z } from 'zod';
import { resolveDbUrl, type DbUrlEnv } from '../effect/config';

export const get_db_url = (env: DbUrlEnv): string => {
  const url = resolveDbUrl(env);
  const url_parse = z
    .string({
      message: 'Connection string for PostgreSQL'
    })
    .safeParse(url);
  if (!url_parse.success) throw new Error(url_parse.error.message);
  return url_parse.data;
};
