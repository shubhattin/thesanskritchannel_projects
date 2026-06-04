import { TRPCError } from '@trpc/server';
import { and, count, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db, type transactionType } from '~/db/db';
import { media_attachment, project_paths, texts, translations } from '~/db/schema';

type TxOrDb = transactionType | typeof db;

export type ProjectPathRow = {
  id: number;
  project_id: number;
  path: string;
};

const pathMatchesPrefixSql = (path: string): SQL =>
  or(eq(project_paths.path, path), sql`${project_paths.path} LIKE ${`${path}:%`}`)!;

export const requireProjectPath = async (
  txOrDb: TxOrDb,
  project_id: number,
  path: string
): Promise<ProjectPathRow> => {
  const row = await txOrDb.query.project_paths.findFirst({
    where: (tbl, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(tbl.project_id, project_id), eqOp(tbl.path, path)),
    columns: { id: true, project_id: true, path: true }
  });
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Project path not found: ${path}` });
  }
  return row;
};

export const requireProjectPaths = async (
  txOrDb: TxOrDb,
  project_id: number,
  paths: string[]
): Promise<Map<string, ProjectPathRow>> => {
  const deduped = [...new Set(paths)];
  if (deduped.length === 0) return new Map();

  const rows = await txOrDb
    .select({ id: project_paths.id, project_id: project_paths.project_id, path: project_paths.path })
    .from(project_paths)
    .where(and(eq(project_paths.project_id, project_id), inArray(project_paths.path, deduped)));

  const byPath = new Map(rows.map((row) => [row.path, row]));
  const missing = deduped.filter((path) => !byPath.has(path));
  if (missing.length > 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Project path not found: ${missing.join(', ')}`
    });
  }
  return byPath;
};

export const insertProjectPaths = async (
  tx: transactionType,
  project_id: number,
  paths: string[]
): Promise<void> => {
  const deduped = [...new Set(paths)];
  if (deduped.length === 0) return;

  const existing = await tx
    .select({ path: project_paths.path })
    .from(project_paths)
    .where(and(eq(project_paths.project_id, project_id), inArray(project_paths.path, deduped)));
  const existingSet = new Set(existing.map((row) => row.path));
  const toInsert = deduped.filter((path) => !existingSet.has(path));
  if (toInsert.length === 0) return;

  await tx.insert(project_paths).values(toInsert.map((path) => ({ project_id, path })));
};

export const listProjectPathsAtOrUnderPrefixes = async (
  tx: transactionType,
  project_id: number,
  prefixes: string[]
): Promise<Array<{ id: number; path: string }>> => {
  const deduped = [...new Set(prefixes)];
  if (deduped.length === 0) return [];
  const clauses = deduped.map((prefix) => pathMatchesPrefixSql(prefix));
  return tx
    .select({ id: project_paths.id, path: project_paths.path })
    .from(project_paths)
    .where(
      and(eq(project_paths.project_id, project_id), clauses.length === 1 ? clauses[0]! : or(...clauses)!)
    )
    .orderBy(project_paths.path);
};

export const countResourcesForProject = async (
  txOrDb: TxOrDb,
  project_id: number,
  table: typeof texts | typeof translations | typeof media_attachment
): Promise<number> => {
  const [row] = await txOrDb
    .select({ count: count() })
    .from(table)
    .innerJoin(project_paths, eq(table.project_path_id, project_paths.id))
    .where(eq(project_paths.project_id, project_id));
  return Number(row?.count ?? 0);
};

export const countExactPathResources = async (
  tx: transactionType,
  project_id: number,
  path: string
): Promise<{
  texts: number;
  translations: number;
  media_attachment: number;
  total: number;
}> => {
  const projectPath = await requireProjectPath(tx, project_id, path);

  const [[textRow], [translationRow], [mediaRow]] = await Promise.all([
    tx.select({ c: count() }).from(texts).where(eq(texts.project_path_id, projectPath.id)),
    tx
      .select({ c: count() })
      .from(translations)
      .where(eq(translations.project_path_id, projectPath.id)),
    tx
      .select({ c: count() })
      .from(media_attachment)
      .where(eq(media_attachment.project_path_id, projectPath.id))
  ]);

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
