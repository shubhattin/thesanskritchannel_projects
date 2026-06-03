import { and, count, eq, or, sql, type AnyColumn } from 'drizzle-orm';
import type { transactionType } from '~/db/db';
import { media_attachment, texts, translations } from '~/db/schema';
import { dbPathMatchesPrefix } from './map_path_swap';
import {
  buildRedisKeysForPathSwapInvalidation,
  type PathSwapInvalidation
} from './map_path_swap_db.server';

const pathMatchesPrefix = (pathColumn: AnyColumn, prefix: string) =>
  or(eq(pathColumn, prefix), sql`${pathColumn} LIKE ${`${prefix}:%`}`);

const pathMatchesAnyPrefix = (pathColumn: AnyColumn, prefixes: string[]) => {
  const clauses = prefixes.map((prefix) => pathMatchesPrefix(pathColumn, prefix));
  return clauses.length === 1 ? clauses[0]! : or(...clauses);
};

const resourceTables = [
  { table: texts, pathColumn: texts.path },
  { table: translations, pathColumn: translations.path },
  { table: media_attachment, pathColumn: media_attachment.path }
] as const;

export const collectDeleteInvalidation = async (
  tx: transactionType,
  project_id: number,
  prefixes: string[]
): Promise<PathSwapInvalidation> => {
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

export const deleteResourcesAtPathPrefixes = async (
  tx: transactionType,
  project_id: number,
  prefixes: string[]
) => {
  if (prefixes.length === 0) return;
  for (const { table, pathColumn } of resourceTables) {
    await tx
      .delete(table)
      .where(and(eq(table.project_id, project_id), pathMatchesAnyPrefix(pathColumn, prefixes)));
  }
};

export const buildRedisKeysForDeleteInvalidation = (
  project_id: number,
  invalidation: PathSwapInvalidation
) => buildRedisKeysForPathSwapInvalidation(project_id, invalidation);

export type ExactPathResourceCounts = {
  texts: number;
  translations: number;
  media_attachment: number;
  total: number;
};

export const countExactPathResources = async (
  tx: transactionType,
  project_id: number,
  dbPath: string
): Promise<ExactPathResourceCounts> => {
  const [textRow] = await tx
    .select({ c: count() })
    .from(texts)
    .where(and(eq(texts.project_id, project_id), eq(texts.path, dbPath)));
  const [translationRow] = await tx
    .select({ c: count() })
    .from(translations)
    .where(and(eq(translations.project_id, project_id), eq(translations.path, dbPath)));
  const [mediaRow] = await tx
    .select({ c: count() })
    .from(media_attachment)
    .where(and(eq(media_attachment.project_id, project_id), eq(media_attachment.path, dbPath)));

  const textsCount = Number(textRow?.c ?? 0);
  const translationsCount = Number(translationRow?.c ?? 0);
  const mediaCount = Number(mediaRow?.c ?? 0);
  return {
    texts: textsCount,
    translations: translationsCount,
    media_attachment: mediaCount,
    total: textsCount + translationsCount + mediaCount
  };
};
