import { Effect } from 'effect';
import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure } from '../trpc_init';
import { delay_dev } from '~/tools/delay';
import { user_project_join, user_project_language_join } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '../trpc_init';
import { get_languages_for_project_user } from './project/project';
import { fetch_get, fetch_post } from '~/tools/fetch';
import {
  APP_SCOPE_ID_PROJECT_PORTAL,
  APP_SCOPES_ENUM,
  type AppScopeEnum
} from '~/state/data_types';
import { get_user_app_scope_status } from '~/utils/auth/app_scope_utils.server';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { AppConfig } from '~/effect/config';
import { dbRun, dbTransaction } from '~/effect/database';

const get_user_info_route = protectedProcedure
  .input(z.object({ user_id: z.string() }))
  .query(({ input: { user_id }, ctx: { user } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(550);
        });

        if (user.role !== 'admin' && user.id !== user_id) {
          return { projects: [], current_app_scope: false };
        }

        const projects_info = yield* dbRun('user.info.projects', (db) =>
          db
            .select({
              project_id: user_project_join.project_id
            })
            .from(user_project_join)
            .where(eq(user_project_join.user_id, user_id))
        );

        const projects = yield* Effect.promise(() =>
          Promise.all(
            projects_info.map(async (project_info) => {
              const languages = await runTrpcEffect(
                get_languages_for_project_user(user_id, project_info.project_id)
              );
              return {
                ...project_info,
                langugae_ids: languages.map((lang) => lang.lang_id)
              };
            })
          )
        );

        return { projects };
      })
    )
  );

const remove_user_from_app_scope_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      scope: APP_SCOPES_ENUM
    })
  )
  .mutation(({ input: { user_id, scope }, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const config = yield* AppConfig;
        const res = yield* Effect.promise(() =>
          fetch_post(`${config.betterAuthUrl}/api/app_scope/remove_user_app_scope`, {
            json: {
              user_id: user_id,
              scope
            },
            headers: {
              Cookie: cookie!
            }
          })
        );
        if (!res.ok) return { success: false };

        if (scope === APP_SCOPE_ID_PROJECT_PORTAL) {
          yield* dbTransaction('user.remove_app_scope.cleanup', async (tx) => {
            await Promise.all([
              tx.delete(user_project_join).where(eq(user_project_join.user_id, user_id)),
              tx
                .delete(user_project_language_join)
                .where(eq(user_project_language_join.user_id, user_id))
            ]);
          });
        }

        return { success: true };
      })
    )
  );

const add_user_to_app_scope_route = protectedAdminProcedure
  .input(z.object({ user_id: z.string(), scope: APP_SCOPES_ENUM }))
  .mutation(({ input: { user_id, scope }, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const config = yield* AppConfig;
        const res = yield* Effect.promise(() =>
          fetch_post(`${config.betterAuthUrl}/api/app_scope/add_user_app_scope`, {
            json: { user_id: user_id, scope },
            headers: { Cookie: cookie! }
          })
        );
        if (!res.ok) return { success: false };
        return { success: true };
      })
    )
  );

const get_user_app_scope_status_route = protectedProcedure
  .input(z.object({ user_id: z.string(), scope_name: APP_SCOPES_ENUM }))
  .query(async ({ input: { user_id, scope_name }, ctx: { user, cookie } }) => {
    if (user.role !== 'admin' && user.id !== user_id) return false;
    return await runTrpcEffect(get_user_app_scope_status(user_id, scope_name, cookie));
  });

const list_user_app_scopes_route = protectedProcedure
  // for both admin users and self only
  .input(z.object({ user_id: z.string() }))
  .query(({ input: { user_id }, ctx: { user, cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        if (user.role !== 'admin' && user.id !== user_id) {
          return { scopes: [] as AppScopeEnum[] };
        }

        const config = yield* AppConfig;
        const res = yield* Effect.promise(() =>
          fetch_get(`${config.betterAuthUrl}/api/app_scope/get_user_app_scope_list`, {
            params: { user_id: user_id },
            headers: { Cookie: cookie! }
          })
        );
        if (!res.ok) return { scopes: [] as AppScopeEnum[] };

        const resp = yield* Effect.promise(() => res.json());
        return z
          .object({
            scopes: APP_SCOPES_ENUM.array()
          })
          .parse(resp);
      })
    )
  );

export const user_router = t.router({
  user_info: get_user_info_route,
  remove_user_from_app_scope: remove_user_from_app_scope_route,
  add_user_to_app_scope: add_user_to_app_scope_route,
  get_user_app_scope_status: get_user_app_scope_status_route,
  list_user_app_scopes: list_user_app_scopes_route
});
