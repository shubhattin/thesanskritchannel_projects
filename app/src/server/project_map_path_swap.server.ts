import { TRPCError } from '@trpc/server';
import { and, eq, or, sql, type AnyColumn } from 'drizzle-orm';
import type { transactionType } from '~/db/db';
import { media_attachment, texts, translations } from '~/db/schema';
import { redis } from '~/db/redis';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import { dbPathToPathParams, toTempDbPath, type PathSwapEdit } from '~/server/map_path_swap';

export type { PathSwapEdit } from '~/server/map_path_swap';
export { validateSwapEdits } from '~/server/map_path_swap';

const pathMatchesPrefix = (pathColumn: AnyColumn, prefix: string) =>
  or(eq(pathColumn, prefix), sql`${pathColumn} LIKE ${`${prefix}:%`}`);

/** True if any row exists at `prefix` or under `prefix:*`. */
const projectHasPathsWithPrefix = async (
  tx: transactionType,
  project_id: number,
  prefix: string
): Promise<boolean> => {
  const textHit = await tx
    .select({ path: texts.path })
    .from(texts)
    .where(and(eq(texts.project_id, project_id), pathMatchesPrefix(texts.path, prefix)))
    .limit(1);

  if (textHit.length > 0) return true;

  const transHit = await tx
    .select({ path: translations.path })
    .from(translations)
    .where(
      and(eq(translations.project_id, project_id), pathMatchesPrefix(translations.path, prefix))
    )
    .limit(1);

  if (transHit.length > 0) return true;

  const mediaHit = await tx
    .select({ path: media_attachment.path })
    .from(media_attachment)
    .where(
      and(
        eq(media_attachment.project_id, project_id),
        pathMatchesPrefix(media_attachment.path, prefix)
      )
    )
    .limit(1);

  return mediaHit.length > 0;
};

const remapPathPrefixOnTable = async (
  tx: transactionType,
  table: typeof texts | typeof translations | typeof media_attachment,
  pathColumn: AnyColumn,
  project_id: number,
  fromPrefix: string,
  toPrefix: string
) => {
  const fromLen = fromPrefix.length;
  await tx
    .update(table)
    .set({
      path: sql`${toPrefix} || substring(${pathColumn} from ${fromLen + 1})`
    })
    .where(and(eq(table.project_id, project_id), pathMatchesPrefix(pathColumn, fromPrefix)));
};

/**
 * Swap all rows at `pathA` (and descendants) with those at `pathB` using `_temp` staging
 * so primary keys never collide mid-transaction.
 */
export const applyDbPathSwap = async (
  tx: transactionType,
  project_id: number,
  pathA: string,
  pathB: string
) => {
  const tempA = toTempDbPath(pathA);
  const tempB = toTempDbPath(pathB);

  if (await projectHasPathsWithPrefix(tx, project_id, tempA)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Cannot swap: staged path "${tempA}" already exists`
    });
  }
  if (await projectHasPathsWithPrefix(tx, project_id, tempB)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Cannot swap: staged path "${tempB}" already exists`
    });
  }

  const tables = [
    { table: texts, path: texts.path },
    { table: translations, path: translations.path },
    { table: media_attachment, path: media_attachment.path }
  ] as const;

  for (const { table, path } of tables) {
    await remapPathPrefixOnTable(tx, table, path, project_id, pathA, tempA);
    await remapPathPrefixOnTable(tx, table, path, project_id, pathB, tempB);
    await remapPathPrefixOnTable(tx, table, path, project_id, tempA, pathB);
    await remapPathPrefixOnTable(tx, table, path, project_id, tempB, pathA);
  }
};

export const applyDbPathSwapsInOrder = async (
  tx: transactionType,
  project_id: number,
  edits: PathSwapEdit[]
) => {
  for (const { swap_paths } of edits) {
    const [pathA, pathB] = swap_paths;
    await applyDbPathSwap(tx, project_id, pathA, pathB);
  }
};

const collectDistinctPathsForPrefixes = async (
  tx: transactionType,
  project_id: number,
  prefixes: string[]
): Promise<string[]> => {
  const paths = new Set<string>();

  for (const prefix of prefixes) {
    const textRows = await tx
      .select({ path: texts.path })
      .from(texts)
      .where(and(eq(texts.project_id, project_id), pathMatchesPrefix(texts.path, prefix)));
    for (const row of textRows) paths.add(row.path);

    const transRows = await tx
      .select({ path: translations.path })
      .from(translations)
      .where(
        and(eq(translations.project_id, project_id), pathMatchesPrefix(translations.path, prefix))
      );
    for (const row of transRows) paths.add(row.path);

    const mediaRows = await tx
      .select({ path: media_attachment.path })
      .from(media_attachment)
      .where(
        and(
          eq(media_attachment.project_id, project_id),
          pathMatchesPrefix(media_attachment.path, prefix)
        )
      );
    for (const row of mediaRows) paths.add(row.path);
  }

  return [...paths];
};

/** Invalidate redis caches for paths touched by swaps (prod only). */
export const invalidateCachesForPathSwaps = async (
  tx: transactionType,
  project_id: number,
  edits: PathSwapEdit[]
) => {
  if (!import.meta.env.PROD) return;

  const prefixes = new Set<string>();
  for (const { swap_paths } of edits) {
    const [pathA, pathB] = swap_paths;
    prefixes.add(pathA);
    prefixes.add(pathB);
    prefixes.add(toTempDbPath(pathA));
    prefixes.add(toTempDbPath(pathB));
  }

  const paths = await collectDistinctPathsForPrefixes(tx, project_id, [...prefixes]);
  const redisKeys = new Set<string>();

  for (const path of paths) {
    const path_params = dbPathToPathParams(path);
    redisKeys.add(REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params));
    redisKeys.add(REDIS_CACHE_KEYS_CLIENT.media_links(project_id, path_params));
  }

  if (prefixes.size > 0) {
    const translationRows = await tx
      .select({ lang_id: translations.lang_id, path: translations.path })
      .from(translations)
      .where(
        and(
          eq(translations.project_id, project_id),
          or(...[...prefixes].map((prefix) => pathMatchesPrefix(translations.path, prefix)))
        )
      );

    for (const row of translationRows) {
      redisKeys.add(
        REDIS_CACHE_KEYS_CLIENT.translation(project_id, row.lang_id, dbPathToPathParams(row.path))
      );
    }
  }

  if (redisKeys.size > 0) {
    await redis.del(...redisKeys);
  }
};
