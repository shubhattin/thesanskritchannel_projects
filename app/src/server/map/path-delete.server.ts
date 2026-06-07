/**
 * Map node deletion helpers (no DB imports).
 */

import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';
import {
  applyPathSwapStepsToPath,
  DB_PATH_RE,
  dbPathMatchesPrefix,
  type PathSwapStep
} from './path-swap';

export type DeletePathCompaction = {
  deleted_path: string;
  remap_steps: PathSwapStep[];
};

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
    const segment = path[i]!;
    if (!Number.isSafeInteger(segment) || segment <= 0) return null;
    const seg = segment - 1;
    if (parent.info.type !== 'list') return null;
    const list = parent.list ?? [];
    if (seg < 0 || seg >= list.length) return null;
    parent = list[seg]!;
  }

  const finalSegment = path[path.length - 1]!;
  if (!Number.isSafeInteger(finalSegment) || finalSegment <= 0) return null;
  const index = finalSegment - 1;
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

function buildDeleteCompactionSteps(path: number[], siblingCount: number): PathSwapStep[] {
  const parentPath = path.slice(0, -1);
  const deletedIndex = path[path.length - 1]!;
  const steps: PathSwapStep[] = [];
  for (let fromIndex = deletedIndex + 1; fromIndex <= siblingCount; fromIndex++) {
    steps.push({
      from_path: mapPathToDbPath([...parentPath, fromIndex]),
      to_path: mapPathToDbPath([...parentPath, fromIndex - 1])
    });
  }
  return steps;
}

/**
 * Builds the ordered DB path compactions that must happen after deleting each subtree.
 * Paths are derived against the evolving map so sibling counts stay correct across batched deletes.
 */
export function buildDeletePathCompactions(
  savedMap: recursive_list_type,
  deletedDbPaths: string[]
): DeletePathCompaction[] {
  const roots = minimizeDbPathPrefixes(deletedDbPaths);
  const paths = sortDeletePathsForRemoval(roots.map(dbPathToMapPath));
  const compactions: DeletePathCompaction[] = [];

  let current = savedMap;
  for (const path of paths) {
    const parentPath = path.slice(0, -1);
    const parent = parentPath.length === 0 ? current : get_node_at_path(current, parentPath);
    if (!parent || parent.info.type !== 'list') {
      throw new Error(`Delete parent /${parentPath.join('/')} was not found in the project map`);
    }
    const siblingCount = (parent.list ?? []).length;
    compactions.push({
      deleted_path: mapPathToDbPath(path),
      remap_steps: buildDeleteCompactionSteps(path, siblingCount)
    });

    const next = remove_node_at_saved_map_path(current, path);
    if (!next) {
      throw new Error(`Failed to remove map path /${path.join('/')}`);
    }
    current = next;
  }

  return compactions;
}

/** Distinct path prefixes whose rows or cache entries can change during delete compaction. */
export function listDeleteCompactionPrefixes(compactions: DeletePathCompaction[]): string[] {
  return [
    ...new Set(
      compactions.flatMap(({ deleted_path, remap_steps }) => [
        deleted_path,
        ...remap_steps.flatMap(({ from_path, to_path }) => [from_path, to_path])
      ])
    )
  ];
}

/** Applies the ordered delete compactions to one DB path the same way the transaction does. */
export function applyDeletePathCompactionsToPath(
  path: string,
  compactions: DeletePathCompaction[]
): string | null {
  let nextPath = path;
  for (const { deleted_path, remap_steps } of compactions) {
    if (dbPathMatchesPrefix(nextPath, deleted_path)) {
      return null;
    }
    nextPath = applyPathSwapStepsToPath(nextPath, remap_steps);
  }
  return nextPath;
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
