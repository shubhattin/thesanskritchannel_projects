import { env } from '$env/dynamic/private';
import { createDb } from '@tsc/server-data/runtime';
import type { pgTransactionType } from './db_types';
import ws from 'ws';

export type { drizzleDbType, pgTransactionType, TxOrDb } from './db_types';

export const db = await createDb(env, {
  isDev: import.meta.env.DEV,
  // fix for neon websocket adapter error
  webSocketConstructor: ws
});

export type transactionType = pgTransactionType | typeof db;
