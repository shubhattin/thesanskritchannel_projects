import { Context, Effect, Layer, Redacted } from 'effect';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import {
  drizzle as drizzleNeon,
  type NeonDatabase,
  type NeonQueryResultHKT
} from 'drizzle-orm/neon-serverless';
import {
  drizzle as drizzleNeonHttp,
  type NeonHttpDatabase
} from 'drizzle-orm/neon-http';
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT
} from 'drizzle-orm/postgres-js';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import postgres from 'postgres';
import ws from 'ws';
import * as schema from '~/db/schema';
import { SharedConfig } from './config';
import { DatabaseError } from './errors';

neonConfig.webSocketConstructor = ws;

export type DbClient =
  | PostgresJsDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

/** HTTP `fetch` is not IoContext-sticky — reuse across Worker requests. */
let workersHttpDb: { url: string; db: NeonHttpDatabase<typeof schema> } | undefined;

const getWorkersHttpDb = (url: string) => {
  if (workersHttpDb?.url === url) return workersHttpDb.db;
  const db = drizzleNeonHttp({ client: neon(url), schema });
  workersHttpDb = { url, db };
  return db;
};

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
   * Workers-safe driver for the Astro site.
   *
   * workerd pins TCP/WebSocket to the creating request, so a singleton Neon
   * `Pool` dies on the second request. HTTP `fetch` is not sticky — Neon's HTTP
   * driver is the right prod path (one POST per query, proxy-side pooling).
   *
   * Opening a WebSocket pool per `dbRun` was the previous prod path and added
   * a TLS+WS handshake on every cache miss (hundreds of ms, sequential).
   *
   * - Local (`isDev`): postgres.js against local Postgres (still per-query)
   * - Prod reads: Neon HTTP (`drizzle-orm/neon-http`)
   * - Prod transactions: short-lived WebSocket `Pool` (site SSR does not use this)
   *
   * Admin stays on `Database.Live` (long-lived pool / session).
   */
  static readonly WorkersLive = Layer.effect(Database)(
    Effect.gen(function* () {
      const config = yield* SharedConfig;
      const url = Redacted.value(config.dbUrl);

      const withReadClient = async <A>(run: (db: DbClient) => A | PromiseLike<A>): Promise<A> => {
        if (config.isDev) {
          const sql = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 5 });
          try {
            return await run(drizzlePostgres(sql, { schema }));
          } finally {
            await sql.end({ timeout: 2 });
          }
        }
        return await run(getWorkersHttpDb(url));
      };

      const withWsClient = async <A>(
        run: (db: NeonDatabase<typeof schema>) => A | PromiseLike<A>
      ): Promise<A> => {
        // Workers has a native WebSocket; Node `ws` is for admin/Vercel / Miniflare.
        neonConfig.webSocketConstructor =
          // oxlint-disable-next-line anti-slop/no-runtime-typeof
          typeof globalThis.WebSocket === 'function' ? globalThis.WebSocket : ws;
        const pool = new Pool({ connectionString: url, max: 1 });
        try {
          return await run(drizzleNeon(pool, { schema }));
        } finally {
          await pool.end();
        }
      };

      return {
        run: (operation, run) => tryDb(operation, () => withReadClient(run)),
        transaction: (operation, run) =>
          tryDb(operation, async () => {
            if (config.isDev) {
              const sql = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 5 });
              try {
                const db = drizzlePostgres(sql, { schema });
                return await db.transaction(async (tx) => await run(tx));
              } finally {
                await sql.end({ timeout: 2 });
              }
            }
            return await withWsClient((db) => db.transaction(async (tx) => await run(tx)));
          })
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
