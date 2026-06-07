import { Context, Effect, Layer } from 'effect';
import { initDb, type drizzleDbType, type transactionType } from '~/db/db';
import { tryPromise } from './try-promise';

export type { transactionType, TxOrDb } from '~/db/db';

export const withDb = <A>(operation: string, fn: (database: drizzleDbType) => Promise<A>) =>
  Effect.flatMap(DbService, (service) => tryPromise(operation, () => fn(service.db)));

export const withTransaction = <A>(operation: string, fn: (tx: transactionType) => Promise<A>) =>
  Effect.flatMap(DbService, (service) => tryPromise(operation, () => service.transaction(fn)));

export class DbService extends Context.Tag('DbService')<
  DbService,
  {
    readonly db: drizzleDbType;
    readonly transaction: drizzleDbType['transaction'];
  }
>() {}

export const DbServiceLive = Layer.effect(
  DbService,
  Effect.gen(function* () {
    const db = yield* Effect.promise(() => initDb());
    return {
      db,
      transaction: db.transaction.bind(db)
    };
  })
);
