import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { recursive_list_schema } from '~/state/data_types';
import { validateDbPath } from './map_path_swap';

export const sort_db_paths_by_depth = (paths: Iterable<string>): string[] =>
  [...paths].sort((a, b) => a.split(':').length - b.split(':').length || a.localeCompare(b));

export const collect_db_paths_from_map = (
  root: z.infer<typeof recursive_list_schema>
): Set<string> => {
  const paths = new Set<string>();
  const walk = (node: z.infer<typeof recursive_list_schema>, path: number[]) => {
    if (path.length > 0) {
      paths.add(path.join(':'));
    }
    if (node.info.type === 'list') {
      (node.list ?? []).forEach((child, index) => walk(child, [...path, index + 1]));
    }
  };
  walk(root, []);
  return paths;
};

export const validate_explicit_to_add_paths = (
  oldPaths: ReadonlySet<string>,
  derivedPaths: ReadonlySet<string>,
  toAddPaths: string[]
): string[] => {
  const uniqueToAddPaths = [...new Set(toAddPaths)];
  if (uniqueToAddPaths.length !== toAddPaths.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Duplicate paths are not allowed in to_add_paths'
    });
  }

  for (const path of uniqueToAddPaths) {
    const error = validateDbPath(path);
    if (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid to_add_paths entry "${path}": ${error}`
      });
    }
    if (!derivedPaths.has(path)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `to_add_paths entry "${path}" is not present in the saved map`
      });
    }
    if (oldPaths.has(path)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `to_add_paths entry "${path}" already exists in the saved map`
      });
    }
  }

  const expectedToAddPaths = sort_db_paths_by_depth(
    [...derivedPaths].filter((path) => !oldPaths.has(path))
  );
  const actualToAddPaths = sort_db_paths_by_depth(uniqueToAddPaths);

  const missingPaths = expectedToAddPaths.filter((path) => !uniqueToAddPaths.includes(path));
  const unexpectedPaths = actualToAddPaths.filter((path) => !expectedToAddPaths.includes(path));
  if (missingPaths.length > 0 || unexpectedPaths.length > 0) {
    const details = [
      missingPaths.length > 0 ? `missing: ${missingPaths.join(', ')}` : null,
      unexpectedPaths.length > 0 ? `unexpected: ${unexpectedPaths.join(', ')}` : null
    ]
      .filter(Boolean)
      .join('; ');
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `to_add_paths must exactly match newly added map paths${details ? ` (${details})` : ''}`
    });
  }

  return actualToAddPaths;
};
