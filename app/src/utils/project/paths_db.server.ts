import { TRPCError } from '@trpc/server';
import { and, count, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { TxOrDb } from '../../db/db_types';
import { media_attachment, project_paths, texts, translations } from '../../db/schema';

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

/**
 * Resolve project_paths row from UI selection (selected_text_levels + project_id).
 * Shared by image generation / gallery / batch routes.
 */
export const resolveSelectedTextProjectPath = async (
  txOrDb: TxOrDb,
  project_id: number,
  selected_text_levels: (number | null)[]
) => {
  const { get_project_info_by_id } = await import('~/utils/project/list.server');
  const { cache_db_options_app } = await import('~/utils/cache.server/cache_db_options.server');
  const { get_path_params } = await import('~/state/project_list');

  const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
  const path_params = get_path_params(selected_text_levels, levels);
  if (levels > 1 && path_params.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid text path selection' });
  }
  const projectPath = await requireProjectPath(txOrDb, project_id, path_params.join(':'));
  return { projectPath, path_params, levels };
};

export const requireProjectPaths = async (
  txOrDb: TxOrDb,
  project_id: number,
  paths: string[]
): Promise<Map<string, ProjectPathRow>> => {
  const deduped = [...new Set(paths)];
  if (deduped.length === 0) return new Map();

  const rows = await txOrDb
    .select({
      id: project_paths.id,
      project_id: project_paths.project_id,
      path: project_paths.path
    })
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
  tx: TxOrDb,
  project_id: number,
  paths: string[]
): Promise<void> => {
  const deduped = [...new Set(paths)];
  if (deduped.length === 0) return;

  await tx
    .insert(project_paths)
    .values(deduped.map((path) => ({ project_id, path })))
    .onConflictDoNothing({
      target: [project_paths.project_id, project_paths.path]
    });
};

/** Deletes exact project_paths rows (cascades texts, translations, and media). */
export const deleteProjectPathsAtExact = async (
  tx: TxOrDb,
  project_id: number,
  paths: string[]
): Promise<void> => {
  const deduped = [...new Set(paths)];
  if (deduped.length === 0) return;

  await tx
    .delete(project_paths)
    .where(and(eq(project_paths.project_id, project_id), inArray(project_paths.path, deduped)));
};

export const listProjectPathsAtOrUnderPrefixes = async (
  tx: TxOrDb,
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
      and(
        eq(project_paths.project_id, project_id),
        clauses.length === 1 ? clauses[0]! : or(...clauses)!
      )
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
  tx: TxOrDb,
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
