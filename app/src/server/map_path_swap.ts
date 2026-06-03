/**
 * Path swap helpers for the map index editor.
 * No DB imports — safe for unit tests.
 *
 * DB paths use colon-separated 1-based segments (e.g. `2:5`), matching `texts.path`,
 * `translations.path`, and `media_attachment.path`.
 */

import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';

/** Staging suffix for two-phase swaps (`1:2` → `1:2_temp` → `1:5`). */
export const PATH_TEMP_SUFFIX = '_temp';

export const DB_PATH_RE = /^[1-9]\d*(?::[1-9]\d*)*$/;

/** One sibling swap from the client, applied in array order. */
export type PathSwapEdit = {
  swap_paths: [string, string];
};

export type PathSwapStep = {
  from_path: string;
  to_path: string;
};

/** Builds the intermediate path used before the final swap (avoids PK collisions). */
export function toTempDbPath(path: string): string {
  return `${path}${PATH_TEMP_SUFFIX}`;
}

/**
 * Builds the ordered remap steps for one client edit.
 * The first path is staged under the target path's `_temp` name, then the target moves into
 * the now-vacant source slot, and finally the staged rows move into the target slot.
 */
export function buildPathSwapSteps(pathA: string, pathB: string): PathSwapStep[] {
  const stagedPath = toTempDbPath(pathB);
  return [
    { from_path: pathA, to_path: stagedPath },
    { from_path: pathB, to_path: pathA },
    { from_path: stagedPath, to_path: pathB }
  ];
}

/** Matches the exact path or any deeper descendant under the same segment boundary. */
export function dbPathMatchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}:`);
}

/** Rewrites one matching prefix and leaves the remaining suffix untouched. */
export function remapDbPathPrefix(path: string, fromPrefix: string, toPrefix: string): string {
  if (!dbPathMatchesPrefix(path, fromPrefix)) {
    return path;
  }
  return `${toPrefix}${path.slice(fromPrefix.length)}`;
}

/** Applies the three-step temp swap to a single DB path. */
export function applyPathSwapStepsToPath(path: string, steps: PathSwapStep[]): string {
  let nextPath = path;
  for (const { from_path, to_path } of steps) {
    nextPath = remapDbPathPrefix(nextPath, from_path, to_path);
  }
  return nextPath;
}

/** Applies the ordered client edits the same way the DB transaction does. */
export function applyPathSwapEditsToPath(path: string, edits: PathSwapEdit[]): string {
  let nextPath = path;
  for (const {
    swap_paths: [pathA, pathB]
  } of edits) {
    nextPath = applyPathSwapStepsToPath(nextPath, buildPathSwapSteps(pathA, pathB));
  }
  return nextPath;
}

/** Distinct prefixes touched by the ordered swaps. */
export function listSwapPrefixes(edits: PathSwapEdit[]): string[] {
  return [...new Set(edits.flatMap(({ swap_paths: [pathA, pathB] }) => [pathA, pathB]))];
}

export function formatMapPath(path: number[]): string {
  return path.length === 0 ? '/' : `/${path.join('/')}`;
}

export function mapPathToDbPath(path: number[]): string {
  return path.join(':');
}

export function dbPathToMapPath(path: string): number[] {
  return dbPathToPathParams(path);
}

/** Order edits may touch only direct children of the chosen root. */
export function isEditableDescendantPath(path: string, rootPath: number[]): boolean {
  if (validateDbPath(path) !== null) {
    return false;
  }
  const segments = path.split(':');
  if (segments.length !== rootPath.length + 1) {
    return false;
  }
  if (rootPath.length === 0) {
    return true;
  }
  return dbPathMatchesPrefix(path, mapPathToDbPath(rootPath));
}

/** Expands one drag move into adjacent swaps so DB and UI end with the same order. */
export function buildAdjacentSwapEdits(
  parentPath: number[],
  fromIndex: number,
  toIndex: number
): PathSwapEdit[] {
  const edits: PathSwapEdit[] = [];
  if (fromIndex === toIndex) {
    return edits;
  }
  const step = fromIndex < toIndex ? 1 : -1;
  for (let i = fromIndex; i !== toIndex; i += step) {
    const pathA = mapPathToDbPath([...parentPath, i + 1]);
    const pathB = mapPathToDbPath([...parentPath, i + step + 1]);
    edits.push({ swap_paths: [pathA, pathB] });
  }
  return edits;
}

/** Converts a DB path string to numeric segments for cache keys (`1:2` → `[1, 2]`). */
export function dbPathToPathParams(path: string): number[] {
  const error = validateDbPath(path);
  if (error) {
    throw new TypeError(`Invalid DB path "${path}": ${error}`);
  }
  return path.split(':').map((s) => Number(s));
}

/** Returns an error message if `path` is not a valid DB path, or `null` if OK. */
export function validateDbPath(path: string): string | null {
  if (!path || path.includes(PATH_TEMP_SUFFIX) || !DB_PATH_RE.test(path)) {
    return 'Path must be a colon-separated list of positive integers (no _temp suffix)';
  }
  return null;
}

/**
 * Validates a single swap pair: same parent, same depth, distinct paths.
 * Returns an error message or `null` if the pair is allowed.
 */
export function validateSwapPair(pathA: string, pathB: string): string | null {
  const errA = validateDbPath(pathA);
  if (errA) return `Path A: ${errA}`;
  const errB = validateDbPath(pathB);
  if (errB) return `Path B: ${errB}`;
  if (pathA === pathB) return 'Cannot swap a path with itself';

  const segmentsA = pathA.split(':');
  const segmentsB = pathB.split(':');
  if (segmentsA.length !== segmentsB.length) {
    return 'Swap paths must be at the same depth in the map';
  }

  const parentA = segmentsA.slice(0, -1).join(':');
  const parentB = segmentsB.slice(0, -1).join(':');
  if (parentA !== parentB) {
    return 'Swap paths must share the same parent path';
  }

  return null;
}

/**
 * Validates the full ordered list of swaps from the frontend.
 * Returns the first error message or `null` if all swaps are allowed.
 */
export function validateSwapEdits(edits: PathSwapEdit[]): string | null {
  if (edits.length === 0) return 'At least one swap is required';

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (
      !edit ||
      typeof edit !== 'object' ||
      !('swap_paths' in edit) ||
      !Array.isArray(edit.swap_paths) ||
      edit.swap_paths.length !== 2
    ) {
      return `Swap ${i + 1}: swap_paths must be a tuple of two paths`;
    }

    const [pathA, pathB] = edit.swap_paths;
    const err = validateSwapPair(pathA, pathB);
    if (err) return `Swap ${i + 1}: ${err}`;
  }

  return null;
}

export function validateSwapEditsRootScope(
  edits: PathSwapEdit[],
  rootPath: number[]
): string | null {
  const rootLabel = formatMapPath(rootPath);
  for (let i = 0; i < edits.length; i++) {
    const [pathA, pathB] = edits[i]!.swap_paths;
    if (!isEditableDescendantPath(pathA, rootPath)) {
      return `Swap ${i + 1}: Path A must stay under root ${rootLabel}`;
    }
    if (!isEditableDescendantPath(pathB, rootPath)) {
      return `Swap ${i + 1}: Path B must stay under root ${rootLabel}`;
    }
  }
  return null;
}

export function validateOrderRootPath(map: recursive_list_type, rootPath: number[]): string | null {
  const root = rootPath.length === 0 ? map : get_node_at_path(map, rootPath);
  if (!root) {
    return `Reorder root ${formatMapPath(rootPath)} was not found in the project map`;
  }
  if (root.info.type !== 'list') {
    return `Reorder root ${formatMapPath(rootPath)} must point to a list node`;
  }
  if ((root.list ?? []).length < 2) {
    return `Reorder root ${formatMapPath(rootPath)} must have at least two direct children`;
  }
  return null;
}

/**
 * Merges normal-mode map edits: metadata, append-only children, and childless shloka/list conversion.
 * Rejects reorder, deletion, conversion with children, and client edits to derived shloka counters.
 */
export function applyMetadataEditsToMap(
  currentMap: recursive_list_type,
  proposedMap: recursive_list_type
): recursive_list_type {
  if (proposedMap.info.type === 'shloka') {
    throw new TypeError('Project map root must be a list node');
  }
  return mergeMetadataNode(currentMap, proposedMap);
}

function mergeMetadataNode(
  current: recursive_list_type,
  proposed: recursive_list_type
): recursive_list_type {
  if (current.info.type === 'list' && proposed.info.type === 'list') {
    return mergeMetadataListNode(current, proposed);
  }
  if (current.info.type === 'shloka' && proposed.info.type === 'shloka') {
    return {
      name_dev: proposed.name_dev,
      info: current.info,
      list: []
    };
  }
  if (isChildlessTypeConversion(current, proposed)) {
    return mergeAfterChildlessTypeConversion(current, proposed);
  }
  throw new TypeError('Map node type changed during metadata save');
}

/** Applies a type swap on a childless server node; proposed may already include new children. */
function mergeAfterChildlessTypeConversion(
  current: recursive_list_type,
  proposed: recursive_list_type
): recursive_list_type {
  if (proposed.info.type === 'list') {
    return mergeMetadataListNode(
      {
        name_dev: proposed.name_dev,
        info: {
          type: 'list',
          list_name: proposed.info.list_name,
          list_count_expected: proposed.info.list_count_expected
        },
        list: []
      },
      proposed
    );
  }
  return adoptConvertedNode(proposed);
}

function mergeMetadataListNode(
  current: recursive_list_type,
  proposed: recursive_list_type
): recursive_list_type {
  if (proposed.info.type !== 'list') {
    throw new TypeError('List node changed type during metadata save');
  }
  const currentChildren = current.list ?? [];
  const proposedChildren = proposed.list ?? [];
  if (proposedChildren.length < currentChildren.length) {
    throw new TypeError('Map structure changed during metadata save');
  }
  if (proposedChildren.length > currentChildren.length) {
    const prefixFingerprints = currentChildren.map(metadataStructureFingerprint);
    const proposedPrefixFingerprints = proposedChildren
      .slice(0, currentChildren.length)
      .map(metadataStructureFingerprint);
    for (let i = 0; i < prefixFingerprints.length; i++) {
      const currentChild = currentChildren[i]!;
      const proposedChild = proposedChildren[i]!;
      if (prefixFingerprints[i] !== proposedPrefixFingerprints[i]) {
        if (
          !isChildlessTypeConversion(currentChild, proposedChild) &&
          !isAppendOnlySubtreeChange(currentChild, proposedChild)
        ) {
          throw new TypeError('Map structure changed during metadata save');
        }
      }
    }
  } else {
    const currentFingerprints = currentChildren.map(metadataStructureFingerprint);
    const proposedFingerprints = proposedChildren.map(metadataStructureFingerprint);
    for (let i = 0; i < currentFingerprints.length; i++) {
      const currentChild = currentChildren[i]!;
      const proposedChild = proposedChildren[i]!;
      if (currentFingerprints[i] !== proposedFingerprints[i]) {
        if (
          !isChildlessTypeConversion(currentChild, proposedChild) &&
          !isAppendOnlySubtreeChange(currentChild, proposedChild)
        ) {
          throw new TypeError('Map structure changed during metadata save');
        }
      }
    }
    assertNoAmbiguousSiblingReorder(currentChildren, proposedChildren);
  }

  const mergedChildren: recursive_list_type[] = [];
  for (let i = 0; i < proposedChildren.length; i++) {
    if (i < currentChildren.length) {
      mergedChildren.push(mergeMetadataNode(currentChildren[i]!, proposedChildren[i]!));
    } else {
      mergedChildren.push(adoptNewSubtree(proposedChildren[i]!));
    }
  }

  return {
    name_dev: proposed.name_dev,
    info: {
      type: 'list',
      list_name: proposed.info.list_name,
      list_count_expected: proposed.info.list_count_expected
    },
    list: mergedChildren
  };
}

function assertNoAmbiguousSiblingReorder(
  currentChildren: recursive_list_type[],
  proposedChildren: recursive_list_type[]
): void {
  const currentFingerprints = currentChildren.map(metadataStructureFingerprint);
  const proposedFingerprints = proposedChildren.map(metadataStructureFingerprint);
  const duplicateFingerprints = new Set(
    currentFingerprints.filter(
      (fingerprint, index) => currentFingerprints.indexOf(fingerprint) !== index
    )
  );
  for (const fingerprint of duplicateFingerprints) {
    const currentLocalIds = currentChildren
      .map((child, index) =>
        currentFingerprints[index] === fingerprint ? metadataLocalIdentity(child) : null
      )
      .filter((value): value is string => value !== null);
    const proposedLocalIds = proposedChildren
      .map((child, index) =>
        proposedFingerprints[index] === fingerprint ? metadataLocalIdentity(child) : null
      )
      .filter((value): value is string => value !== null);
    if (
      currentLocalIds.join('|') !== proposedLocalIds.join('|') &&
      [...currentLocalIds].sort().join('|') === [...proposedLocalIds].sort().join('|')
    ) {
      throw new TypeError('Ambiguous sibling identity changed during metadata save');
    }
  }
}

function isAppendOnlySubtreeChange(
  current: recursive_list_type,
  proposed: recursive_list_type
): boolean {
  if (current.info.type !== 'list' || proposed.info.type !== 'list') {
    return false;
  }
  const currentChildren = current.list ?? [];
  const proposedChildren = proposed.list ?? [];
  if (proposedChildren.length <= currentChildren.length) {
    return false;
  }
  for (let i = 0; i < currentChildren.length; i++) {
    const currentChild = currentChildren[i]!;
    const proposedChild = proposedChildren[i]!;
    if (
      metadataStructureFingerprint(currentChild) !== metadataStructureFingerprint(proposedChild)
    ) {
      if (
        !isChildlessTypeConversion(currentChild, proposedChild) &&
        !isAppendOnlySubtreeChange(currentChild, proposedChild)
      ) {
        return false;
      }
    }
  }
  return true;
}

function isChildlessTypeConversion(
  current: recursive_list_type,
  proposed: recursive_list_type
): boolean {
  if (current.info.type === proposed.info.type) {
    return false;
  }
  if ((current.list ?? []).length > 0) {
    return false;
  }
  return (
    (current.info.type === 'shloka' && proposed.info.type === 'list') ||
    (current.info.type === 'list' && proposed.info.type === 'shloka')
  );
}

function adoptConvertedNode(proposed: recursive_list_type): recursive_list_type {
  if (proposed.info.type === 'list') {
    return {
      name_dev: proposed.name_dev,
      info: {
        type: 'list',
        list_name: proposed.info.list_name,
        list_count_expected: proposed.info.list_count_expected
      },
      list: []
    };
  }
  return {
    name_dev: proposed.name_dev,
    info: {
      type: 'shloka',
      shloka_count: 0,
      total: 0,
      shloka_count_expected:
        proposed.info.type === 'shloka' ? proposed.info.shloka_count_expected : null
    },
    list: []
  };
}

function adoptNewSubtree(proposed: recursive_list_type): recursive_list_type {
  if (proposed.info.type === 'shloka') {
    return {
      name_dev: proposed.name_dev,
      info: {
        type: 'shloka',
        shloka_count: 0,
        total: 0,
        shloka_count_expected:
          proposed.info.type === 'shloka' ? proposed.info.shloka_count_expected : null
      },
      list: []
    };
  }
  return {
    name_dev: proposed.name_dev,
    info: {
      type: 'list',
      list_name: proposed.info.list_name,
      list_count_expected: proposed.info.list_count_expected
    },
    list: (proposed.list ?? []).map(adoptNewSubtree)
  };
}

function metadataStructureFingerprint(node: recursive_list_type): string {
  if (node.info.type === 'shloka') {
    return JSON.stringify({ type: 'shloka' });
  }
  return JSON.stringify({
    type: 'list',
    child_count: (node.list ?? []).length,
    children: (node.list ?? []).map(metadataStructureFingerprint)
  });
}

function metadataLocalIdentity(node: recursive_list_type): string {
  if (node.info.type === 'shloka') {
    return JSON.stringify({
      type: 'shloka',
      name_dev: node.name_dev
    });
  }
  return JSON.stringify({
    type: 'list',
    name_dev: node.name_dev,
    list_name: node.info.list_name,
    list_count_expected: node.info.list_count_expected
  });
}

/** Applies the exact swap sequence to the map JSON so the saved structure matches DB path swaps. */
export function applySwapEditsToMap(
  map: recursive_list_type,
  edits: PathSwapEdit[]
): recursive_list_type {
  const next = JSON.parse(JSON.stringify(map)) as recursive_list_type;
  for (const {
    swap_paths: [pathA, pathB]
  } of edits) {
    const parentPath = dbPathToMapPath(pathA).slice(0, -1);
    const indexA = dbPathToMapPath(pathA).at(-1)! - 1;
    const indexB = dbPathToMapPath(pathB).at(-1)! - 1;
    const parent = parentPath.length === 0 ? next : get_node_at_path(next, parentPath);
    if (!parent || parent.info.type !== 'list') {
      throw new TypeError(
        `Cannot apply swap under missing parent "${mapPathToDbPath(parentPath)}"`
      );
    }
    const list = [...(parent.list ?? [])];
    if (indexA < 0 || indexB < 0 || indexA >= list.length || indexB >= list.length) {
      throw new RangeError(`Cannot apply swap "${pathA}" <-> "${pathB}" outside list bounds`);
    }
    [list[indexA], list[indexB]] = [list[indexB]!, list[indexA]!];
    parent.list = list;
  }
  return next;
}
