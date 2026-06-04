import { eq, inArray } from 'drizzle-orm';
import type { transactionType } from '~/db/db';
import { media_attachment, project_paths, texts, translations } from '~/db/schema';
import type { DeletePathCompaction } from './map_path_delete.server';
import {
  buildRedisKeysForPathSwapInvalidation,
  type PathSwapInvalidation
} from './map_path_swap_db.server';
import {
  countExactPathResources,
  listProjectPathsAtOrUnderPrefixes
} from './project_paths_db.server';
import { remapDbPathPrefix } from './map_path_swap';

export const collectDeleteInvalidation = async (
  tx: transactionType,
  project_id: number,
  prefixes: string[]
): Promise<PathSwapInvalidation> => {
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

export const deleteResourcesAtPathPrefixes = async (
  tx: transactionType,
  project_id: number,
  prefixes: string[]
) => {
  if (prefixes.length === 0) return;
  const paths = await listProjectPathsAtOrUnderPrefixes(tx, project_id, prefixes);
  if (paths.length === 0) return;
  await tx.delete(project_paths).where(
    inArray(
      project_paths.id,
      paths.map((row) => row.id)
    )
  );
};

export const applyDeletePathCompactions = async (
  tx: transactionType,
  project_id: number,
  compactions: DeletePathCompaction[]
) => {
  if (compactions.length === 0) return;
  for (const { remap_steps } of compactions) {
    if (remap_steps.length === 0) continue;
    for (const { from_path, to_path } of remap_steps) {
      const rows = await listProjectPathsAtOrUnderPrefixes(tx, project_id, [from_path]);
      for (const row of rows) {
        await tx
          .update(project_paths)
          .set({ path: remapDbPathPrefix(row.path, from_path, to_path) })
          .where(eq(project_paths.id, row.id));
      }
    }
  }
};

export const buildRedisKeysForDeleteInvalidation = (
  project_id: number,
  invalidation: PathSwapInvalidation
) => buildRedisKeysForPathSwapInvalidation(project_id, invalidation);

export type ExactPathResourceCounts = Awaited<ReturnType<typeof countExactPathResources>>;
