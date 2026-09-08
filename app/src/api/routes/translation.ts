import { Effect } from 'effect';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAppScopeProcedure_ProjectsPortal, publicProcedure, t } from '~/api/trpc_init';
import { texts, translations } from '~/db/schema';
import { dbRun, dbTransaction, type TxOrDb } from '~/effect/database';
import { BadRequestError, NotFoundError } from '~/effect/errors';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { delay_dev } from '~/tools/delay';
import { get_project_by_key, get_project_info_by_id } from '~/utils/project/list.server';
import { get_languages_for_project_user } from './project/project';
import { get_path_params } from '~/state/project_list';
import { CACHE, invalidate_and_refresh_cached } from '~/utils/cache.server/cached_loader.server';
import { TEXT_EDIT_LOCK_NAMESPACE } from '~/utils/text/row_edit.server';

const edit_translation_input = z
  .object({
    project_id: z.int(),
    lang_id: z.int(),
    data: z.string().nullable().array(),
    indexes: z.number().array(),
    selected_text_levels: z.array(z.int().nullable())
  })
  .refine(({ data, indexes }) => data.length === indexes.length, {
    message: 'data and indexes must have the same length'
  })
  .refine(({ indexes }) => new Set(indexes).size === indexes.length, {
    message: 'indexes must be unique'
  });

/** Convert higher→lower path params into selected_text_levels (lower→higher). */
export const path_params_to_selected_text_levels = (
  path_params: number[],
  levels: number
): (number | null)[] => path_params.slice(0, levels - 1).reverse();

type PersistTranslationsArgs = {
  project_id: number;
  lang_id: number;
  project_path_id: number;
  path_params: number[];
  indexes: number[];
  data: (string | null)[];
  /** When true, caller must invalidate caches (e.g. batched auto-approve). */
  skip_cache_invalidation?: boolean;
};

/**
 * DB writes for translation rows on a project path.
 * Overwrites existing non-null values; null deletes the row.
 * Returns a domain failure reason instead of throwing so callers can map to Effect errors.
 */
export const persistTranslationsRows = async (
  tx: TxOrDb,
  args: Pick<
    PersistTranslationsArgs,
    'project_id' | 'lang_id' | 'project_path_id' | 'indexes' | 'data'
  >
): Promise<{ ok: true } | { ok: false; reason: 'missing_text'; index: number }> => {
  const { project_id, lang_id, project_path_id, indexes, data } = args;
  const indexed_indexes = indexes.map((v, i) => [v, i] as const);

  await tx.execute(sql`select pg_advisory_xact_lock(${TEXT_EDIT_LOCK_NAMESPACE}, ${project_id})`);

  const current_text_indexes = new Set(
    (
      await tx
        .select({ index: texts.index })
        .from(texts)
        .where(and(eq(texts.project_path_id, project_path_id), inArray(texts.index, indexes)))
    ).map((v) => v.index)
  );
  const missing_text_index = indexed_indexes.find(
    ([index, i]) => data[i] !== null && !current_text_indexes.has(index)
  );
  if (missing_text_index) {
    return { ok: false, reason: 'missing_text', index: missing_text_index[0] };
  }

  const existing_indexes = new Set(
    (
      await tx
        .select({ index: translations.index })
        .from(translations)
        .where(
          and(
            eq(translations.project_path_id, project_path_id),
            eq(translations.lang_id, lang_id),
            inArray(translations.index, indexes)
          )
        )
    ).map((v) => v.index)
  );

  const delete_entries = indexed_indexes.filter(([, i]) => data[i] === null);
  const add_entries = indexed_indexes.filter(
    ([index, i]) => data[i] !== null && !existing_indexes.has(index)
  );
  const update_entries = indexed_indexes.filter(
    ([index, i]) => data[i] !== null && existing_indexes.has(index)
  );

  if (delete_entries.length > 0) {
    await tx.delete(translations).where(
      and(
        eq(translations.project_path_id, project_path_id),
        eq(translations.lang_id, lang_id),
        inArray(
          translations.index,
          delete_entries.map(([index]) => index)
        )
      )
    );
  }
  if (add_entries.length > 0) {
    await tx.insert(translations).values(
      add_entries.map(([index, i]) => ({
        project_path_id,
        lang_id,
        index,
        text: data[i] ?? ''
      }))
    );
  }
  if (update_entries.length > 0) {
    // Single statement — do not Promise.all on the same tx connection (neon/postgres-js).
    const value_rows = update_entries.map(
      ([index, dataIndex]) => sql`(${index}::int, ${data[dataIndex] ?? ''}::text)`
    );
    await tx.execute(sql`
      UPDATE ${translations} AS t
      SET text = v.text, updated_at = now()
      FROM (VALUES ${sql.join(value_rows, sql`, `)}) AS v(index, text)
      WHERE t.project_path_id = ${project_path_id}
        AND t.lang_id = ${lang_id}
        AND t.index = v.index
    `);
  }

  return { ok: true };
};

/**
 * Persist translation rows for a project path.
 * Overwrites existing non-null values; null deletes the row.
 */
export const persist_translations_for_path = Effect.fn('persist_translations_for_path')(function* (
  args: PersistTranslationsArgs
) {
  const {
    project_id,
    lang_id,
    project_path_id,
    path_params,
    indexes,
    data,
    skip_cache_invalidation = false
  } = args;

  if (indexes.length !== data.length) {
    return yield* Effect.fail(
      BadRequestError.make({ message: 'data and indexes must have the same length' })
    );
  }
  if (new Set(indexes).size !== indexes.length) {
    return yield* Effect.fail(BadRequestError.make({ message: 'indexes must be unique' }));
  }
  if (indexes.length === 0) {
    // SAFETY: no indexes to persist — the empty array is a valid (number | null)[] selection.
    return { success: true as const, selected_text_levels: [] as (number | null)[] };
  }

  const { levels } = yield* get_project_info_by_id(project_id);
  const selected_text_levels = path_params_to_selected_text_levels(path_params, levels);

  const outcome = yield* dbTransaction('translation.tx.1', (tx) =>
    persistTranslationsRows(tx, {
      project_id,
      lang_id,
      project_path_id,
      indexes,
      data
    })
  );

  if (!outcome.ok) {
    return yield* Effect.fail(
      BadRequestError.make({
        message: `Translation index has no matching text row: ${outcome.index}`
      })
    );
  }

  if (!skip_cache_invalidation) {
    yield* Effect.all(
      [
        invalidate_and_refresh_cached(CACHE.translation, {
          project_id,
          lang_id,
          selected_text_levels
        }),
        invalidate_and_refresh_cached(CACHE.available_translation_langs, {
          project_id,
          path_params
        })
      ],
      { concurrency: 'unbounded' }
    );
  }

  return { success: true as const, selected_text_levels };
});

const require_project_path = Effect.fn('require_project_path')(function* (
  project_id: number,
  path: string
) {
  const row = yield* dbRun('translation.require_path', (db) =>
    db.query.project_paths.findFirst({
      where: (tbl, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(tbl.project_id, project_id), eqOp(tbl.path, path)),
      columns: { id: true, project_id: true, path: true }
    })
  );
  if (!row) {
    return yield* Effect.fail(
      NotFoundError.make({
        resource: 'project_path',
        message: `Project path not found: ${path}`
      })
    );
  }
  return row;
});

const get_translation_route = publicProcedure
  .input(
    z.object({
      project_id: z.int(),
      lang_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .query(({ input: { project_id, lang_id, selected_text_levels } }) =>
    runTrpcEffect(CACHE.translation.get({ project_id, lang_id, selected_text_levels }))
  );

const edit_translation_route = protectedAppScopeProcedure_ProjectsPortal
  .input(edit_translation_input)
  .mutation(({ ctx: { user }, input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const { project_id, lang_id, selected_text_levels, data, indexes } = input;
        const { levels } = yield* get_project_info_by_id(project_id);
        const path_params = get_path_params(selected_text_levels, levels);
        if (levels > 1 && path_params.length === 0) {
          return yield* Effect.fail(
            BadRequestError.make({ message: 'Invalid text path selection' })
          );
        }
        const projectPath = yield* require_project_path(project_id, path_params.join(':'));

        if (user.role !== 'admin') {
          const languages = yield* get_languages_for_project_user(user.id, project_id);
          const allowed_langs = languages.map((lang) => lang.lang_id);
          if (!allowed_langs.includes(lang_id)) return { success: false as const };
        }

        return yield* persist_translations_for_path({
          project_id,
          lang_id,
          project_path_id: projectPath.id,
          path_params,
          indexes,
          data
        });
      })
    )
  );

const get_langs_with_translations_route = protectedAppScopeProcedure_ProjectsPortal
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.int().array()
    })
  )
  .query(({ input: { project_key, path_params } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const project = yield* get_project_by_key(project_key);
        if (!project) {
          return yield* Effect.fail(
            NotFoundError.make({
              resource: 'project',
              message: `Project not found: ${project_key}`
            })
          );
        }
        return yield* CACHE.available_translation_langs.get({
          project_id: project.id,
          path_params
        });
      })
    )
  );

const get_all_langs_translation_route = protectedAppScopeProcedure_ProjectsPortal
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.int().nullable().array()
    })
  )
  .query(({ input: { project_id, selected_text_levels } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const { levels } = yield* get_project_info_by_id(project_id);
        const path_params = get_path_params(selected_text_levels, levels);
        if (levels > 1 && path_params.length === 0) {
          return yield* Effect.fail(
            BadRequestError.make({ message: 'Invalid text path selection' })
          );
        }
        const projectPath = yield* require_project_path(project_id, path_params.join(':'));
        const data = yield* dbRun('translation.ml.1', (db) =>
          db
            .select({
              index: translations.index,
              text: translations.text,
              lang_id: translations.lang_id
            })
            .from(translations)
            .where(eq(translations.project_path_id, projectPath.id))
            .orderBy(translations.lang_id, translations.index)
        );
        const data_map = new Map<number, Map<number, string>>();
        for (let i = 0; i < data.length; i++) {
          if (!data_map.has(data[i].lang_id)) data_map.set(data[i].lang_id, new Map());
          data_map.get(data[i].lang_id)!.set(data[i].index, data[i].text);
        }
        return data_map;
      })
    )
  );

export const translation_router = t.router({
  get_translation: get_translation_route,
  edit_translation: edit_translation_route,
  get_langs_with_translations: get_langs_with_translations_route,
  get_all_langs_translation: get_all_langs_translation_route
});
