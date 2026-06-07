import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { transactionType } from '~/db/db';
import { media_attachment, project_paths, texts, translations } from '~/db/schema';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import { buildPathSwapSteps, dbPathToPathParams, toTempDbPath, type PathSwapEdit } from './swap';
import { listProjectPathsAtOrUnderPrefixes } from '../project/paths_db.server';

const assertNoRowsAtPrefix = async (
  tx: transactionType,
  project_id: number,
  prefix: string,
  message: string
) => {
  const hit = await tx.query.project_paths.findFirst({
    where: (tbl, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(tbl.project_id, project_id), eqOp(tbl.path, prefix)),
    columns: { id: true }
  });
  if (hit) {
    throw new TRPCError({ code: 'CONFLICT', message });
  }
};

const remapPathPrefixOnProjectPaths = async (
  tx: transactionType,
  project_id: number,
  fromPrefix: string,
  toPrefix: string
) => {
  const fromPrefixLength = fromPrefix.length;
  const substringStart = sql.raw(String(fromPrefixLength + 1));
  await tx
    .update(project_paths)
    .set({
      path: sql`${toPrefix} || substring(${project_paths.path} from ${substringStart})`
    })
    .where(
      and(
        eq(project_paths.project_id, project_id),
        sql`(${project_paths.path} = ${fromPrefix} OR ${project_paths.path} LIKE ${`${fromPrefix}:%`})`
      )
    );
};

export const applyOrderedDbPathSwaps = async (
  tx: transactionType,
  project_id: number,
  edits: PathSwapEdit[]
) => {
  for (const {
    swap_paths: [pathA, pathB]
  } of edits) {
    const stagedPath = toTempDbPath(pathB);
    await assertNoRowsAtPrefix(
      tx,
      project_id,
      stagedPath,
      `Cannot reorder paths because staged path "${stagedPath}" already exists`
    );

    const steps = buildPathSwapSteps(pathA, pathB);
    for (const { from_path, to_path } of steps) {
      await remapPathPrefixOnProjectPaths(tx, project_id, from_path, to_path);
    }
  }
};

export type PathSwapInvalidation = {
  textAndMediaPaths: string[];
  translationPaths: { lang_id: number; path: string }[];
};

export const mergePathSwapInvalidation = (
  ...invalidations: PathSwapInvalidation[]
): PathSwapInvalidation => {
  const textAndMediaPaths = new Set<string>();
  const translationPaths = new Map<string, { lang_id: number; path: string }>();

  for (const invalidation of invalidations) {
    for (const path of invalidation.textAndMediaPaths) {
      textAndMediaPaths.add(path);
    }
    for (const row of invalidation.translationPaths) {
      translationPaths.set(`${row.lang_id}:${row.path}`, row);
    }
  }

  return {
    textAndMediaPaths: [...textAndMediaPaths],
    translationPaths: [...translationPaths.values()]
  };
};

export const collectPathSwapInvalidation = async (
  tx: transactionType,
  project_id: number,
  edits: PathSwapEdit[]
): Promise<PathSwapInvalidation> => {
  const prefixes = [...new Set(edits.flatMap(({ swap_paths: [pathA, pathB] }) => [pathA, pathB]))];
  if (prefixes.length === 0) {
    return { textAndMediaPaths: [], translationPaths: [] };
  }

  const paths = await listProjectPathsAtOrUnderPrefixes(tx, project_id, prefixes);
  const projectPathIds = paths.map((row) => row.id);
  if (projectPathIds.length === 0) {
    return { textAndMediaPaths: [], translationPaths: [] };
  }

  const [textRows, mediaRows, translationRows] = await Promise.all([
    tx
      .select({ path: project_paths.path })
      .from(texts)
      .innerJoin(project_paths, eq(texts.project_path_id, project_paths.id))
      .where(inArray(texts.project_path_id, projectPathIds)),
    tx
      .select({ path: project_paths.path })
      .from(media_attachment)
      .innerJoin(project_paths, eq(media_attachment.project_path_id, project_paths.id))
      .where(inArray(media_attachment.project_path_id, projectPathIds)),
    tx
      .select({ lang_id: translations.lang_id, path: project_paths.path })
      .from(translations)
      .innerJoin(project_paths, eq(translations.project_path_id, project_paths.id))
      .where(inArray(translations.project_path_id, projectPathIds))
  ]);

  const pathSet = new Set<string>();
  for (const row of textRows) pathSet.add(row.path);
  for (const row of mediaRows) pathSet.add(row.path);
  for (const row of translationRows) pathSet.add(row.path);

  return {
    textAndMediaPaths: [...pathSet],
    translationPaths: translationRows
  };
};

export const buildRedisKeysForPathSwapInvalidation = (
  project_id: number,
  invalidation: PathSwapInvalidation
) => {
  const keys = new Set<string>();

  for (const path of invalidation.textAndMediaPaths) {
    const pathParams = dbPathToPathParams(path);
    keys.add(REDIS_CACHE_KEYS_CLIENT.text_data(project_id, pathParams));
    keys.add(REDIS_CACHE_KEYS_CLIENT.media_links(project_id, pathParams));
  }

  for (const { lang_id, path } of invalidation.translationPaths) {
    keys.add(REDIS_CACHE_KEYS_CLIENT.translation(project_id, lang_id, dbPathToPathParams(path)));
  }

  return [...keys];
};
