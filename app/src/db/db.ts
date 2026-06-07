import { env } from '$env/dynamic/private';
import { createDb } from '@tsc/server-data/runtime';
import type { drizzleDbType, pgTransactionType } from './db_types';
import ws from 'ws';

export type { drizzleDbType, pgTransactionType, TxOrDb } from './db_types';

let dbInstance: drizzleDbType | undefined;
let dbInitPromise: Promise<drizzleDbType> | undefined;

/** Lazily creates the shared Drizzle instance (no top-level await for bundlers). */
export const initDb = (): Promise<drizzleDbType> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!dbInitPromise) {
    dbInitPromise = createDb(env, {
      isDev: import.meta.env.DEV,
      webSocketConstructor: ws
    }).then((instance) => {
      dbInstance = instance;
      return instance;
    });
  }
  return dbInitPromise;
};

export type transactionType = pgTransactionType | drizzleDbType;
