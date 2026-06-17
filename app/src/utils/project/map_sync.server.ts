import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { recursive_list_schema } from '~/state/data_types';
import { ROOT_DB_PATH, validateDbPath } from '../map_path/swap';

export const sort_db_paths_by_depth = (paths: Iterable<string>): string[] =>
  [...paths].sort(
    (a, b) =>
      (a === ROOT_DB_PATH ? 0 : a.split(':').length) -
        (b === ROOT_DB_PATH ? 0 : b.split(':').length) || a.localeCompare(b)
  );

/** DB paths for shloka leaves only — list nodes do not own texts/translations/media rows. */
export const collect_shloka_db_paths_from_map = (
  root: z.infer<typeof recursive_list_schema>
): Set<string> => {
  const paths = new Set<string>();
  const walk = (node: z.infer<typeof recursive_list_schema>, path: number[]) => {
    if (node.info.type === 'shloka') {
      paths.add(path.length === 0 ? ROOT_DB_PATH : path.join(':'));
      return;
    }
    (node.list ?? []).forEach((child, index) => walk(child, [...path, index + 1]));
  };
  walk(root, []);
  return paths;
};

/** @deprecated Use collect_shloka_db_paths_from_map — project_paths rows are shloka-only. */
export const collect_db_paths_from_map = collect_shloka_db_paths_from_map;

export const diff_shloka_db_paths = (
  oldMap: z.infer<typeof recursive_list_schema>,
  newMap: z.infer<typeof recursive_list_schema>
) => {
  const oldPaths = collect_shloka_db_paths_from_map(oldMap);
  const newPaths = collect_shloka_db_paths_from_map(newMap);
  return {
    toInsert: sort_db_paths_by_depth([...newPaths].filter((path) => !oldPaths.has(path))),
    toRemove: sort_db_paths_by_depth([...oldPaths].filter((path) => !newPaths.has(path)))
  };
};

/** Validates client-declared new shloka paths; server applies the full shloka-path diff. */
export const validate_explicit_to_add_paths = (
  oldPaths: ReadonlySet<string>,
  derivedPaths: ReadonlySet<string>,
  toAddPaths: string[]
): void => {
  const uniqueToAddPaths = [...new Set(toAddPaths)];
  if (uniqueToAddPaths.length !== toAddPaths.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Duplicate paths are not allowed in to_add_paths'
    });
  }

  const expectedToInsert = new Set([...derivedPaths].filter((path) => !oldPaths.has(path)));

  for (const path of uniqueToAddPaths) {
    const error = path === ROOT_DB_PATH ? null : validateDbPath(path);
    if (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid to_add_paths entry "${path}": ${error}`
      });
    }
    if (!derivedPaths.has(path)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `to_add_paths entry "${path}" is not a shloka path in the saved map`
      });
    }
    if (oldPaths.has(path)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `to_add_paths entry "${path}" already exists as a shloka path in the saved map`
      });
    }
    if (!expectedToInsert.has(path)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `to_add_paths entry "${path}" is not a newly required shloka path`
      });
    }
  }
};
