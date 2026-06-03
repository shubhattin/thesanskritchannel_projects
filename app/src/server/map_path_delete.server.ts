/**
 * Map node deletion helpers (no DB imports).
 */

import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';
import { DB_PATH_RE, dbPathMatchesPrefix } from './map_path_swap';

export function mapPathToDbPath(path: number[]): string {
  return path.join(':');
}

export function dbPathToMapPath(dbPath: string): number[] {
  return dbPath.split(':').map((s) => Number(s));
}

/** Drop paths that are already covered by a deleted ancestor prefix. */
export function minimizeDbPathPrefixes(paths: string[]): string[] {
  const sorted = [...new Set(paths)].sort((a, b) => a.length - b.length);
  const result: string[] = [];
  for (const path of sorted) {
    if (result.some((prefix) => dbPathMatchesPrefix(path, prefix))) continue;
    result.push(path);
  }
  return result;
}

export function validateDeletedPathsInMap(
  map: recursive_list_type,
  deletedDbPaths: string[]
): string | null {
  for (const dbPath of deletedDbPaths) {
    if (!DB_PATH_RE.test(dbPath)) {
      return `Invalid path "${dbPath}"`;
    }
    const mapPath = dbPathToMapPath(dbPath);
    if (mapPath.length === 0) {
      return 'Cannot delete project root';
    }
    if (!get_node_at_path(map, mapPath)) {
      return `Path "${dbPath}" does not exist in the saved map`;
    }
  }
  return null;
}

export const clone_recursive_map = (node: recursive_list_type): recursive_list_type =>
  JSON.parse(JSON.stringify(node)) as recursive_list_type;

/** Removes one node; returns null for project root or invalid paths. */
export function remove_node_at_saved_map_path(
  map: recursive_list_type,
  path: number[]
): recursive_list_type | null {
  if (path.length === 0) return null;

  const root = clone_recursive_map(map);
  let parent: recursive_list_type = root;

  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]! - 1;
    if (parent.info.type !== 'list') return null;
    const list = parent.list ?? [];
    if (seg < 0 || seg >= list.length) return null;
    parent = list[seg]!;
  }

  const index = path[path.length - 1]! - 1;
  if (parent.info.type !== 'list') return null;
  const list = [...(parent.list ?? [])];
  if (index < 0 || index >= list.length) return null;
  list.splice(index, 1);
  parent.list = list;
  return root;
}

/**
 * Derives the post-delete map from the persisted tree by removing only the requested subtrees.
 * Deletes deepest paths first so sibling indices stay valid.
 */
/** Deepest paths first; among siblings, higher 1-based indices first so paths stay valid. */
export function sortDeletePathsForRemoval(paths: number[][]): number[][] {
  return [...paths].sort((a, b) => {
    const maxLen = Math.max(a.length, b.length);
    for (let i = maxLen - 1; i >= 0; i--) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      if (av !== bv) return bv - av;
    }
    return 0;
  });
}

export function applyDeletedSubtreesToMap(
  savedMap: recursive_list_type,
  deletedDbPaths: string[]
): recursive_list_type {
  const roots = minimizeDbPathPrefixes(deletedDbPaths);
  const paths = sortDeletePathsForRemoval(roots.map(dbPathToMapPath));

  let current = savedMap;
  for (const path of paths) {
    const next = remove_node_at_saved_map_path(current, path);
    if (!next) {
      throw new Error(`Failed to remove map path /${path.join('/')}`);
    }
    current = next;
  }
  return current;
}

export function mapsStructurallyEqual(a: recursive_list_type, b: recursive_list_type): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Ensures a client-submitted map is exactly the saved map with only `deletedDbPaths` removed.
 * The delete mutation should persist `applyDeletedSubtreesToMap(...)` instead of trusting the client.
 */
export function validateDeleteMapProposal(
  savedMap: recursive_list_type,
  proposedMap: recursive_list_type,
  deletedDbPaths: string[]
): string | null {
  const pathError = validateDeletedPathsInMap(savedMap, deletedDbPaths);
  if (pathError) return pathError;

  const derived = applyDeletedSubtreesToMap(savedMap, deletedDbPaths);
  if (!mapsStructurallyEqual(derived, proposedMap)) {
    return 'Submitted map must match the saved map with only the requested subtrees removed';
  }
  return null;
}
