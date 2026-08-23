import { Effect } from 'effect';
import { and, asc, eq, ne } from 'drizzle-orm';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import { media_attachment, texts, translations } from '~/db/schema';
import { SiteLekhaSchemaZod } from '~/db/schema_zod';
import type { shloka_list_type } from '~/state/data_types';
import { shloka_list_schema } from '~/state/data_types';
import { get_path_params } from '~/state/project_list';
import { dbPathToPathParams } from '~/utils/map_path/swap';
import type { PathSwapInvalidation } from '~/utils/map_path/swap_db.server';
import { requireProjectPath } from '~/utils/project/paths_db.server';
import type z from 'zod';
import { z as zod } from 'zod';
import {
  createCache,
  invalidateAndRefreshCache,
  NO_CACHE_PARAMS,
  type NoCacheParams
} from './cache';
import { dbRun } from './database';
import { CacheError } from './errors';
import {
  getProjectByKey,
  getProjectInfoById,
  projectListCache,
  projectMapCache
} from './project_registry';

const lekhaSchema = SiteLekhaSchemaZod;
type lekhaType = z.infer<typeof lekhaSchema>;

const lekhaListSchema = lekhaSchema.omit({ content: true }).array();
type lekhaListType = z.infer<typeof lekhaListSchema>;

export type TextDataParams = { key: string; path_params: number[] };

export type TranslationParams = {
  project_id: number;
  lang_id: number;
  selected_text_levels: (number | null)[];
};

export type AvailableTranslationLangsParams = {
  project_id: number;
  path_params: number[];
};

export type MediaLinkRow = {
  id: number;
  lang_id: number | null;
  media_type: string;
  link: string;
  name: string;
  order: number;
};

export type MediaLinksParams = {
  project_id: number;
  path_params: number[];
};

type TranslationRow = { index: number; text: string };

const translationRowSchema = zod.object({
  index: zod.number(),
  text: zod.string()
});

const mediaLinkRowSchema = zod.object({
  id: zod.number(),
  lang_id: zod.number().nullable(),
  media_type: zod.string(),
  link: zod.string(),
  name: zod.string(),
  order: zod.number()
});

type TextDataInnerParams = { project_id: number; path_params: number[] };

type TranslationInnerParams = {
  project_id: number;
  lang_id: number;
  path_params: number[];
};

const toCacheError = (operation: string) => (cause: unknown) =>
  cause instanceof CacheError ? cause : CacheError.make({ operation, key: undefined, cause });

const textDataInner = createCache<TextDataInnerParams, shloka_list_type>({
  getKey: ({ project_id, path_params }) =>
    REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params),
  schema: shloka_list_schema,
  fetch: Effect.fn('text_data.fetch')(function* ({ project_id, path_params }) {
    return yield* dbRun('text_data.fetch', async (db) => {
      const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
      return db
        .select({
          text: texts.text,
          index: texts.index,
          shloka_num: texts.shloka_num
        })
        .from(texts)
        .where(eq(texts.project_path_id, projectPath.id))
        .orderBy(texts.index);
    }).pipe(Effect.mapError(toCacheError('text_data.fetch')));
  })
});

/** Public text_data cache — resolves project key → id so redis keys stay id-based. */
export const textDataCache = {
  get: Effect.fn('text_data.get')(function* (params: TextDataParams) {
    const project = yield* getProjectByKey(params.key);
    if (!project) {
      return yield* Effect.fail(
        CacheError.make({
          operation: 'text_data.get',
          cause: new Error(`Project not found: ${params.key}`)
        })
      );
    }
    return yield* textDataInner.get({
      project_id: project.id,
      path_params: params.path_params
    });
  }),
  delete: Effect.fn('text_data.delete')(function* (params: TextDataParams) {
    const project = yield* getProjectByKey(params.key);
    if (!project) return;
    yield* textDataInner.delete({
      project_id: project.id,
      path_params: params.path_params
    });
  }),
  refresh: Effect.fn('text_data.refresh')(function* (
    params: TextDataParams,
    opts?: { deleteFirst?: boolean }
  ) {
    const project = yield* getProjectByKey(params.key);
    if (!project) return;
    yield* textDataInner.refresh({ project_id: project.id, path_params: params.path_params }, opts);
  }),
  key: (params: TextDataParams) =>
    Effect.gen(function* () {
      const project = yield* getProjectByKey(params.key);
      if (!project) {
        return `text_data:missing:${params.key}:${params.path_params.join('/')}`;
      }
      return REDIS_CACHE_KEYS_CLIENT.text_data(project.id, params.path_params);
    })
};

const translationInner = createCache<TranslationInnerParams, TranslationRow[], Map<number, string>>(
  {
    getKey: ({ project_id, lang_id, path_params }) =>
      REDIS_CACHE_KEYS_CLIENT.translation(project_id, lang_id, path_params),
    schema: translationRowSchema.array(),
    fetch: Effect.fn('translation.fetch')(function* ({ project_id, lang_id, path_params }) {
      return yield* dbRun('translation.fetch', async (db) => {
        const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
        return db
          .select({
            index: translations.index,
            text: translations.text
          })
          .from(translations)
          .where(
            and(eq(translations.project_path_id, projectPath.id), eq(translations.lang_id, lang_id))
          )
          .orderBy(translations.index);
      }).pipe(Effect.mapError(toCacheError('translation.fetch')));
    }),
    transform: (rows) => {
      const data_map = new Map<number, string>();
      for (const row of rows) data_map.set(row.index, row.text);
      return data_map;
    }
  }
);

const resolveTranslationPath = Effect.fn('resolveTranslationPath')(function* (
  project_id: number,
  selected_text_levels: (number | null)[]
) {
  const { levels } = yield* getProjectInfoById(project_id).pipe(
    Effect.mapError(toCacheError('translation.resolveLevels'))
  );
  const path_params = get_path_params(selected_text_levels, levels);
  if (levels > 1 && path_params.length === 0) {
    return yield* Effect.fail(
      CacheError.make({
        operation: 'translation.path',
        cause: new Error('Invalid text path selection')
      })
    );
  }
  return { levels, path_params };
});

/** Public translation cache — params use selected_text_levels; redis keys use path_params. */
export const translationCache = {
  get: Effect.fn('translation.get')(function* (params: TranslationParams) {
    const { path_params } = yield* resolveTranslationPath(
      params.project_id,
      params.selected_text_levels
    );
    return yield* translationInner.get({
      project_id: params.project_id,
      lang_id: params.lang_id,
      path_params
    });
  }),
  delete: Effect.fn('translation.delete')(function* (params: TranslationParams) {
    const { path_params } = yield* resolveTranslationPath(
      params.project_id,
      params.selected_text_levels
    );
    yield* translationInner.delete({
      project_id: params.project_id,
      lang_id: params.lang_id,
      path_params
    });
  }),
  refresh: Effect.fn('translation.refresh')(function* (
    params: TranslationParams,
    opts?: { deleteFirst?: boolean }
  ) {
    const { path_params } = yield* resolveTranslationPath(
      params.project_id,
      params.selected_text_levels
    );
    yield* translationInner.refresh(
      {
        project_id: params.project_id,
        lang_id: params.lang_id,
        path_params
      },
      opts
    );
  }),
  key: (params: TranslationParams) =>
    Effect.gen(function* () {
      const { path_params } = yield* resolveTranslationPath(
        params.project_id,
        params.selected_text_levels
      );
      return REDIS_CACHE_KEYS_CLIENT.translation(params.project_id, params.lang_id, path_params);
    })
};

export const availableTranslationLangsCache = createCache<
  AvailableTranslationLangsParams,
  number[]
>({
  getKey: ({ project_id, path_params }) =>
    REDIS_CACHE_KEYS_CLIENT.available_translation_langs(project_id, path_params),
  schema: zod.number().array(),
  fetch: Effect.fn('available_translation_langs.fetch')(function* ({ project_id, path_params }) {
    return yield* dbRun('available_translation_langs.fetch', async (db) => {
      const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
      const rows = await db
        .select({ lang_id: translations.lang_id })
        .from(translations)
        .where(and(eq(translations.project_path_id, projectPath.id), ne(translations.text, '')))
        .groupBy(translations.lang_id);
      return rows.map((row) => row.lang_id);
    }).pipe(Effect.mapError(toCacheError('available_translation_langs.fetch')));
  })
});

export const mediaLinksCache = createCache<MediaLinksParams, MediaLinkRow[]>({
  getKey: ({ project_id, path_params }) =>
    REDIS_CACHE_KEYS_CLIENT.media_links(project_id, path_params),
  schema: mediaLinkRowSchema.array(),
  fetch: Effect.fn('media_links.fetch')(function* ({ project_id, path_params }) {
    return yield* dbRun('media_links.fetch', async (db) => {
      const projectPath = await db.query.project_paths.findFirst({
        where: (tbl, { and: andOp, eq: eqOp }) =>
          andOp(eqOp(tbl.project_id, project_id), eqOp(tbl.path, path_params.join(':'))),
        columns: { id: true }
      });
      if (!projectPath) return [];
      return db
        .select({
          id: media_attachment.id,
          link: media_attachment.link,
          media_type: media_attachment.media_type,
          lang_id: media_attachment.lang_id,
          name: media_attachment.name,
          order: media_attachment.order
        })
        .from(media_attachment)
        .where(eq(media_attachment.project_path_id, projectPath.id))
        .orderBy(asc(media_attachment.order));
    }).pipe(Effect.mapError(toCacheError('media_links.fetch')));
  })
});

export const siteLekhaDataCache = createCache<{ url_slug: string }, lekhaType | null>({
  getKey: ({ url_slug }) => REDIS_CACHE_KEYS_CLIENT.site_lekha_data(url_slug),
  schema: lekhaSchema,
  shouldCache: (data) => data !== null,
  fetch: Effect.fn('site_lekha_data.fetch')(function* ({ url_slug }) {
    return yield* dbRun('site_lekha_data.fetch', async (db) => {
      const data = await db.query.site_lekhas.findFirst({
        where: (tbl, { eq: eqSlug }) => eqSlug(tbl.url_slug, url_slug)
      });
      return data ?? null;
    }).pipe(Effect.mapError(toCacheError('site_lekha_data.fetch')));
  })
});

/**
 * TODO : implement caching, paging and sorting
 *
 * Gives listed non-draft lekhas
 */
export const siteLekhaListCache = createCache<NoCacheParams, lekhaListType>({
  getKey: () => REDIS_CACHE_KEYS_CLIENT.site_lekha_list(),
  schema: lekhaListSchema,
  fetch: Effect.fn('site_lekha_list.fetch')(function* (_params) {
    return yield* dbRun('site_lekha_list.fetch', (db) =>
      db.query.site_lekhas.findMany({
        columns: {
          id: true,
          title: true,
          description: true,
          tags: true,
          created_at: true,
          published_at: true,
          updated_at: true,
          draft: true,
          listed: true,
          search_indexed: true,
          url_slug: true
        },
        orderBy: ({ published_at }, { desc }) => desc(published_at),
        where: (tbl, { eq: eqCol, and: andOp }) =>
          andOp(eqCol(tbl.draft, false), eqCol(tbl.listed, true))
      })
    ).pipe(Effect.mapError(toCacheError('site_lekha_list.fetch')));
  })
});

/**
 * Typed registry of cache loaders keyed by `REDIS_CACHE_KEYS_CLIENT` name.
 */
export const CACHE = {
  available_translation_langs: availableTranslationLangsCache,
  media_links: mediaLinksCache,
  project_list: projectListCache,
  project_map: projectMapCache,
  site_lekha_data: siteLekhaDataCache,
  site_lekha_list: siteLekhaListCache,
  text_data: textDataCache,
  translation: translationCache
};

export { NO_CACHE_PARAMS, invalidateAndRefreshCache };

/** Await cache delete, then warm cache in background. */
export const invalidateAndRefreshCached = invalidateAndRefreshCache;

const path_params_to_selected_text_levels = (
  path_params: number[],
  levels: number
): (number | null)[] => path_params.slice(0, levels - 1).reverse();

/** Invalidate text/translation/media caches for map path edits. */
export const invalidatePathCaches = Effect.fn('invalidatePathCaches')(function* (
  project_id: number,
  project_key: string,
  invalidation: PathSwapInvalidation
) {
  const { levels } = yield* getProjectInfoById(project_id).pipe(
    Effect.mapError(toCacheError('invalidatePathCaches.levels'))
  );

  const tasks = [];

  for (const path of invalidation.textAndMediaPaths) {
    const path_params = dbPathToPathParams(path);
    tasks.push(
      invalidateAndRefreshCache(CACHE.text_data, { key: project_key, path_params }).pipe(
        Effect.catch(() => Effect.void)
      )
    );
    tasks.push(
      invalidateAndRefreshCache(CACHE.available_translation_langs, {
        project_id,
        path_params
      }).pipe(Effect.catch(() => Effect.void))
    );
    tasks.push(
      CACHE.media_links.delete({ project_id, path_params }).pipe(Effect.catch(() => Effect.void))
    );
  }

  for (const { lang_id, path } of invalidation.translationPaths) {
    const path_params = dbPathToPathParams(path);
    const selected_text_levels = path_params_to_selected_text_levels(path_params, levels);
    tasks.push(
      invalidateAndRefreshCache(CACHE.translation, {
        project_id,
        lang_id,
        selected_text_levels
      }).pipe(Effect.catch(() => Effect.void))
    );
  }

  yield* Effect.all(tasks, { concurrency: 'unbounded', discard: true });
});
