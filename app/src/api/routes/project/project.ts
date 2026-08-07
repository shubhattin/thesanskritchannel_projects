import { Effect } from 'effect';
import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure } from '../../trpc_init';
import { delay_dev } from '~/tools/delay';
import { projects, user_project_join, user_project_language_join } from '~/db/schema';
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { t } from '../../trpc_init';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import ms from 'ms';
import { get_project_list, get_project_map_by_id } from '~/utils/project/list.server';
import { project_edit_router } from './project_edit';
import { project_map_edit_router } from './project_map_edit';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { enqueueBackground } from '~/effect/background';
import { dbRun, dbTransaction, type TxOrDb } from '~/effect/database';
import { DatabaseError } from '~/effect/errors';
import { RedisClient } from '~/effect/redis';

const queryUserProjectLanguages = (client: TxOrDb, user_id: string, project_id: number) =>
  client
    .select({
      lang_id: user_project_language_join.language_id
    })
    .from(user_project_language_join)
    .where(
      and(
        eq(user_project_language_join.user_id, user_id),
        eq(user_project_language_join.project_id, project_id)
      )
    );

export const get_languages_for_project_user = Effect.fn('get_languages_for_project_user')(
  function* (user_id: string, project_id: number, db_instance?: TxOrDb) {
    const redis = yield* RedisClient;
    const cacheKey = REDIS_CACHE_KEYS_CLIENT.user_project_info(user_id, project_id);

    // When participating in a caller transaction, always read from that tx.
    if (!db_instance) {
      const cache = yield* redis.get<{ lang_id: number }[]>(cacheKey);
      if (cache) return cache;
    }

    const languages = db_instance
      ? yield* Effect.tryPromise({
          try: () => queryUserProjectLanguages(db_instance, user_id, project_id),
          catch: (cause) => DatabaseError.make({ operation: 'project.user_languages.tx', cause })
        })
      : yield* dbRun('project.user_languages', (db) =>
          queryUserProjectLanguages(db, user_id, project_id)
        );

    if (!db_instance) {
      yield* enqueueBackground(() =>
        Effect.runPromise(
          redis.set(cacheKey, languages, {
            ex: ms('20days') / 1000
          })
        )
      );
    }

    return languages;
  }
);

const add_to_project_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      project_id: z.int()
    })
  )
  .mutation(({ input: { user_id, project_id } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });
        yield* dbRun('project.add_user', async (db) => {
          await db.insert(user_project_join).values({
            user_id,
            project_id
          });
        });
        return { success: true };
      })
    )
  );

const remove_from_project_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      project_id: z.int()
    })
  )
  .mutation(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const { user_id, project_id } = input;
        yield* dbTransaction('project.remove_user', async (tx) => {
          await Promise.all([
            tx
              .delete(user_project_join)
              .where(
                and(
                  eq(user_project_join.user_id, user_id),
                  eq(user_project_join.project_id, project_id)
                )
              ),
            tx
              .delete(user_project_language_join)
              .where(
                and(
                  eq(user_project_language_join.user_id, user_id),
                  eq(user_project_language_join.project_id, project_id)
                )
              )
          ]);
        });
        const redis = yield* RedisClient;
        yield* redis.deleteKeysWithPattern(REDIS_CACHE_KEYS_CLIENT.user_project_info(user_id, '*'));
        return { success: true };
      })
    )
  );

const update_project_languages_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      project_id: z.int(),
      languages_id: z.int().array()
    })
  )
  .mutation(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const { user_id, project_id, languages_id } = input;
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });
        const redis = yield* RedisClient;

        yield* dbTransaction('project.update_languages', async (tx) => {
          const languages_current = await queryUserProjectLanguages(tx, user_id, project_id);

          const current_set = new Set(languages_current.map((lang) => lang.lang_id));
          const target_set = new Set(languages_id);

          await Promise.all([
            ...languages_current
              .filter((lang) => !target_set.has(lang.lang_id))
              .map((lang) =>
                tx
                  .delete(user_project_language_join)
                  .where(
                    and(
                      eq(user_project_language_join.user_id, user_id),
                      eq(user_project_language_join.project_id, project_id),
                      eq(user_project_language_join.language_id, lang.lang_id)
                    )
                  )
              ),
            ...Array.from(target_set)
              .filter((lang_id) => !current_set.has(lang_id))
              .map((lang_id) =>
                tx.insert(user_project_language_join).values({
                  user_id,
                  project_id,
                  language_id: lang_id
                })
              )
          ]);
        });

        yield* redis.del(REDIS_CACHE_KEYS_CLIENT.user_project_info(user_id, project_id));
        return { success: true };
      })
    )
  );

export const user_project_info_route = protectedProcedure
  .input(
    z.object({
      project_id: z.int()
    })
  )
  .query(({ input: { project_id }, ctx: { user } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(550);
        });
        const languages = yield* get_languages_for_project_user(user.id, project_id);
        return { languages };
      })
    )
  );

const get_project_list_input = z.object({
  /** When true, returns the full project list (for app-wide registry lookups). */
  all: z.boolean().default(false),
  page: z.int().min(1).default(1),
  size: z.int().min(1).max(100).default(15),
  search: z.string().max(500).optional(),
  /** When set, only projects with this listed value are returned. */
  listed: z.boolean().optional()
});

const get_project_list_route = protectedProcedure
  .input(get_project_list_input)
  .query(({ input, ctx: { user } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const is_admin = user.role === 'admin';

        if (input.all) {
          const list = yield* get_project_list(is_admin ? undefined : { listed_only: true });
          return {
            list,
            total: list.length,
            page: 1,
            pageCount: 1,
            hasPrev: false,
            hasNext: false
          };
        }

        const trimmedSearch = input.search?.trim();
        const searchCondition = trimmedSearch
          ? or(
              ilike(projects.name, `%${trimmedSearch}%`),
              ilike(projects.name_dev, `%${trimmedSearch}%`),
              ilike(projects.description, `%${trimmedSearch}%`)
            )
          : undefined;
        const listedCondition = is_admin
          ? input.listed === undefined
            ? undefined
            : eq(projects.listed, input.listed)
          : eq(projects.listed, true);
        const whereClause = and(searchCondition, listedCondition);
        const offset = (input.page - 1) * input.size;

        const [countResult, list] = yield* dbRun('project.list.page', async (db) =>
          Promise.all([
            db.select({ count: count() }).from(projects).where(whereClause),
            db
              .select({
                id: projects.id,
                name: projects.name,
                name_dev: projects.name_dev,
                description: projects.description,
                key: projects.key,
                listed: projects.listed
              })
              .from(projects)
              .where(whereClause)
              .orderBy(asc(projects.id))
              .limit(input.size)
              .offset(offset)
          ])
        );

        const total = Number(countResult[0]?.count ?? 0);
        const pageCount = Math.max(1, Math.ceil(total / input.size));

        return {
          list,
          total,
          page: input.page,
          pageCount,
          hasPrev: input.page > 1,
          hasNext: input.page < pageCount
        };
      })
    )
  );

const get_project_map_route = protectedProcedure
  .input(z.object({ project_id: z.int() }))
  .query(({ input: { project_id } }) => runTrpcEffect(get_project_map_by_id(project_id)));

export const project_router = t.router({
  add_to_project: add_to_project_route,
  remove_from_project: remove_from_project_route,
  update_project_languages: update_project_languages_route,
  user_project_info: user_project_info_route,
  get_project_list: get_project_list_route,
  get_project_map: get_project_map_route,
  edit: project_edit_router,
  map_edit: project_map_edit_router
});
