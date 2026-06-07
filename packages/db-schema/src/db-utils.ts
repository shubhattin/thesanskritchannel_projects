import { z } from 'zod';

export type DbEnv = {
  DB_MODE?: string;
  PG_DATABASE_URL?: string;
  PG_DATABASE_URL1?: string;
  PG_DATABASE_URL2?: string;
};

export const get_db_url = (env: DbEnv): string => {
  let url: string | undefined;
  const dbMode = env.DB_MODE ?? (typeof process !== 'undefined' ? process.env.DB_MODE : undefined);

  if (dbMode === 'PROD') url = env.PG_DATABASE_URL1;
  else if (dbMode === 'PREVIEW') url = env.PG_DATABASE_URL2;
  else url = env.PG_DATABASE_URL;

  const url_parse = z
    .string({
      message: 'Connection string for PostgreSQL'
    })
    .safeParse(url);
  if (!url_parse.success) throw new Error(url_parse.error.message);
  return url_parse.data;
};
