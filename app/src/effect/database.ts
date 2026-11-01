import { Context, Effect, Layer, Redacted } from 'effect';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT
} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '~/db/schema';
import { SharedConfig } from './config';
import { DatabaseError } from './errors';

export type DbClient = PostgresJsDatabase<typeof schema>;

export type DbTransaction =
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  | DbClient;

/** Tx or session client — for helpers that only query/mutate rows. */
export type TxOrDb = DbTransaction;

/** Drizzle builders are Thenable but not typed as Promise — accept both. */
const tryDb = <A>(operation: string, run: () => A | PromiseLike<A>) =>
  Effect.tryPromise({
    try: async () => await run(),
    catch: (cause) => DatabaseError.make({ operation, cause })
  }).pipe(Effect.annotateLogs({ category: 'db', operation }));

/**
 * postgres.js over TCP (local Postgres in dev, PlanetScale PgBouncer on 6432 in prod).
 * One pool per server instance, shared by app + site and every request.
 * - PgBouncer transaction pooling: prepared statements off (also locally, so dev matches prod).
 *   Transaction-scoped features (SET LOCAL, pg_advisory_xact_lock) are safe; session-level
 *   state (SET, pg_advisory_lock, LISTEN) is not.
 * - Idle sockets close after 20s so a suspended instance or dev hot reload never pins slots.
 * `postgres()` only holds config; sockets open lazily on the first query.
 */
export class Database extends Context.Service<
  Database,
  {
    readonly run: <A>(
      operation: string,
      run: (client: DbClient) => A | PromiseLike<A>
    ) => Effect.Effect<A, DatabaseError>;
    readonly transaction: <A>(
      operation: string,
      run: (tx: DbTransaction) => A | PromiseLike<A>
    ) => Effect.Effect<A, DatabaseError>;
  }
>()('Database') {
  static readonly Live = Layer.effect(Database)(
    Effect.gen(function* () {
      const config = yield* SharedConfig;
      const url = Redacted.value(config.dbUrl);

      const sql = yield* Effect.acquireRelease(
        Effect.try({
          try: () =>
            postgres(url, {
              prepare: false,
              max: config.isDev ? 5 : 10,
              idle_timeout: 20,
              max_lifetime: 60 * 30
            }),
          catch: (cause) => DatabaseError.make({ operation: 'connect', cause })
        }),
        (sql) =>
          Effect.promise(async () => {
            try {
              await sql.end({ timeout: 5 });
            } catch {
              // Ignore cleanup failures during runtime dispose.
            }
          })
      );
      const db = drizzlePostgres(sql, { schema });

      return {
        run: (operation, run) => tryDb(operation, () => run(db)),
        transaction: (operation, run) =>
          tryDb(operation, () => db.transaction(async (tx) => await run(tx)))
      };
    })
  );
}

export const dbRun = <A>(operation: string, run: (client: DbClient) => A | PromiseLike<A>) =>
  Effect.gen(function* () {
    const database = yield* Database;
    return yield* database.run(operation, run);
  });

export const dbTransaction = <A>(
  operation: string,
  run: (tx: DbTransaction) => A | PromiseLike<A>
) =>
  Effect.gen(function* () {
    const database = yield* Database;
    return yield* database.transaction(operation, run);
  });
