import { Context, Effect, Layer, Redacted } from 'effect';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import {
  drizzle as drizzleNeon,
  type NeonDatabase,
  type NeonQueryResultHKT
} from 'drizzle-orm/neon-serverless';
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT
} from 'drizzle-orm/postgres-js';
import { neonConfig, Pool } from '@neondatabase/serverless';
import postgres from 'postgres';
import * as schema from '~/db/schema';
import { SharedConfig } from './config';
import { DatabaseError } from './errors';

/**
 * Native WebSocket is available in every runtime we target (Node 22+, Bun,
 * workerd), so Neon uses it directly — no `ws` package, which is CJS-only and
 * breaks the Cloudflare Worker bundle (`createRequire(import.meta.url)` is
 * undefined on workerd).
 */
neonConfig.webSocketConstructor = globalThis.WebSocket;

export type DbClient = PostgresJsDatabase<typeof schema> | NeonDatabase<typeof schema>;

export type DbTransaction =
  | PgTransaction<NeonQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  | DbClient;

/** Tx or root DB client — used by operations that participate in caller transactions. */
export type TxOrDb = DbTransaction;

/** Drizzle builders are Thenable but not typed as Promise — accept both. */
const tryDb = <A>(operation: string, run: () => A | PromiseLike<A>) =>
  Effect.tryPromise({
    try: async () => await run(),
    catch: (cause) => DatabaseError.make({ operation, cause })
  }).pipe(Effect.annotateLogs({ category: 'db', operation }));

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

      type OwnedClient =
        | {
            kind: 'postgres';
            sql: ReturnType<typeof postgres>;
            db: PostgresJsDatabase<typeof schema>;
          }
        | {
            kind: 'neon';
            pool: Pool;
            db: NeonDatabase<typeof schema>;
          };

      const owned = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async (): Promise<OwnedClient> => {
            if (config.isDev) {
              const sql = postgres(url);
              return {
                kind: 'postgres',
                sql,
                db: drizzlePostgres(sql, { schema })
              };
            }
            const pool = new Pool({ connectionString: url });
            return {
              kind: 'neon',
              pool,
              db: drizzleNeon(pool, { schema })
            };
          },
          catch: (cause) => DatabaseError.make({ operation: 'connect', cause })
        }),
        (client) =>
          Effect.promise(async () => {
            try {
              if (client.kind === 'postgres') await client.sql.end({ timeout: 5 });
              else await client.pool.end();
            } catch {
              // Ignore cleanup failures during runtime dispose.
            }
          })
      );

      return {
        run: (operation, run) => tryDb(operation, () => run(owned.db)),
        transaction: (operation, run) =>
          tryDb(operation, () => owned.db.transaction(async (tx) => await run(tx)))
      };
    })
  );

  /**
   * Workers-safe driver for the site (Cloudflare workerd).
   *
   * Cloudflare isolates I/O objects (TCP/WebSocket) to the request that created
   * them, so a singleton `postgres` / Neon `Pool` dies on the second request.
   * Both local and prod open a fresh client per query and close it after.
   *
   * - Local (`isDev`): postgres.js against local Postgres
   * - Prod: Neon WebSocket `Pool` (same adapter as admin `Database.Live`)
   *
   * Admin stays on `Database.Live` (long-lived pool / session).
   */
  static readonly WorkersLive = Layer.effect(Database)(
    Effect.gen(function* () {
      const config = yield* SharedConfig;
      const url = Redacted.value(config.dbUrl);

      const withClient = async <A>(run: (db: DbClient) => A | PromiseLike<A>): Promise<A> => {
        if (config.isDev) {
          const sql = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 5 });
          try {
            return await run(drizzlePostgres(sql, { schema }));
          } finally {
            await sql.end({ timeout: 2 });
          }
        }

        const pool = new Pool({ connectionString: url, max: 1 });
        try {
          return await run(drizzleNeon(pool, { schema }));
        } finally {
          await pool.end();
        }
      };

      return {
        run: (operation, run) => tryDb(operation, () => withClient(run)),
        transaction: (operation, run) =>
          tryDb(operation, () => withClient((db) => db.transaction(async (tx) => await run(tx))))
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
