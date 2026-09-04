import { error, json, type RequestHandler } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { projects } from '@app/db/schema';
import { CACHE } from '@app/effect/cache_loaders';
import { dbRun } from '@app/effect/database';
import { getProjectInfoByKey } from '@app/effect/project_registry';
import { NONE_LANG_ID } from '$lib/cookies';
import { get_selected_text_levels_from_path_params } from '~/utils/text-routes';
import { runServerEffect } from '~/effect/site_runtime';

export const GET: RequestHandler = async ({ url }) => {
  const project_id = Number(url.searchParams.get('project_id'));
  const lang_id = Number(url.searchParams.get('lang_id'));
  const path_params_raw = url.searchParams.get('path_params') ?? '';

  if (!Number.isInteger(project_id) || project_id < 1) {
    error(400, 'Invalid project_id');
  }
  if (!Number.isInteger(lang_id)) {
    error(400, 'Invalid lang_id');
  }

  if (lang_id === NONE_LANG_ID) {
    return json({ translation: null });
  }

  const path_params =
    path_params_raw.trim() === ''
      ? []
      : path_params_raw.split(',').map((part) => {
          const n = Number(part);
          if (!Number.isInteger(n) || n < 1) {
            error(400, 'Invalid path_params');
          }
          return n;
        });

  const translation = await runServerEffect(
    Effect.gen(function* () {
      const row = yield* dbRun('get_trans.project', (db) =>
        db.query.projects.findFirst({
          where: eq(projects.id, project_id),
          columns: { key: true }
        })
      );
      if (!row) return null;

      const info = yield* getProjectInfoByKey(row.key);
      const selected_text_levels = get_selected_text_levels_from_path_params(
        path_params,
        info.levels
      );
      const map = yield* CACHE.translation.get({
        project_id,
        lang_id,
        selected_text_levels
      });
      if (!map) return null;
      return Object.fromEntries(map) as Record<number, string>;
    })
  );

  return json({ translation });
};
