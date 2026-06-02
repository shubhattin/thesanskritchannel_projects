import { TRPCError } from '@trpc/server';
import { and, eq, or, sql, type AnyColumn } from 'drizzle-orm';
import type { transactionType } from '~/db/db';
import { media_attachment, texts, translations } from '~/db/schema';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import {
  buildPathSwapSteps,
  dbPathToPathParams,
  toTempDbPath,
  type PathSwapEdit
} from './map_path_swap';

const pathMatchesPrefix = (pathColumn: AnyColumn, prefix: string) =>
  or(eq(pathColumn, prefix), sql`${pathColumn} LIKE ${`${prefix}:%`}`);

const pathMatchesAnyPrefix = (pathColumn: AnyColumn, prefixes: string[]) => {
  const clauses = prefixes.map((prefix) => pathMatchesPrefix(pathColumn, prefix));
  return clauses.length === 1 ? clauses[0]! : or(...clauses);
};

const swapTables = [
  { table: texts, pathColumn: texts.path },
  { table: translations, pathColumn: translations.path },
  { table: media_attachment, pathColumn: media_attachment.path }
] as const;

const tableHasPathPrefix = async (
  tx: transactionType,
  table: typeof texts | typeof translations | typeof media_attachment,
  pathColumn: AnyColumn,
  project_id: number,
  prefix: string
) => {
  const hit = await tx
    .select()
    .from(table)
    .where(and(eq(table.project_id, project_id), pathMatchesPrefix(pathColumn, prefix)))
    .limit(1);

  return hit.length > 0;
};

const assertNoRowsAtPrefix = async (
  tx: transactionType,
  project_id: number,
  prefix: string,
  message: string
) => {
  for (const { table, pathColumn } of swapTables) {
    if (await tableHasPathPrefix(tx, table, pathColumn, project_id, prefix)) {
      throw new TRPCError({ code: 'CONFLICT', message });
    }
  }
};

const remapPathPrefixOnTable = async (
  tx: transactionType,
  table: typeof texts | typeof translations | typeof media_attachment,
  pathColumn: AnyColumn,
  project_id: number,
  fromPrefix: string,
  toPrefix: string
) => {
  const fromPrefixLength = fromPrefix.length;
  const substringStart = sql.raw(String(fromPrefixLength + 1));
  await tx
    .update(table)
    .set({
      // Use a literal numeric start position so Postgres does integer slicing, not regex
      // `substring(text from pattern)` semantics on a bound parameter.
      path: sql`${toPrefix} || substring(${pathColumn} from ${substringStart})`
    })
    .where(and(eq(table.project_id, project_id), pathMatchesPrefix(pathColumn, fromPrefix)));
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
    for (const { table, pathColumn } of swapTables) {
      for (const { from_path, to_path } of steps) {
        await remapPathPrefixOnTable(tx, table, pathColumn, project_id, from_path, to_path);
      }
    }
  }
};

export type PathSwapInvalidation = {
  textAndMediaPaths: string[];
  translationPaths: { lang_id: number; path: string }[];
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

  const textRows = await tx
    .select({ path: texts.path })
    .from(texts)
    .where(and(eq(texts.project_id, project_id), pathMatchesAnyPrefix(texts.path, prefixes)));

  const mediaRows = await tx
    .select({ path: media_attachment.path })
    .from(media_attachment)
    .where(
      and(
        eq(media_attachment.project_id, project_id),
        pathMatchesAnyPrefix(media_attachment.path, prefixes)
      )
    );

  const translationRows = await tx
    .select({ lang_id: translations.lang_id, path: translations.path })
    .from(translations)
    .where(
      and(
        eq(translations.project_id, project_id),
        pathMatchesAnyPrefix(translations.path, prefixes)
      )
    );

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
