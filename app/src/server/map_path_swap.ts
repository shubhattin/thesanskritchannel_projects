/**
 * Path swap helpers for the map index editor.
 * No DB imports — safe for unit tests.
 *
 * DB paths use colon-separated 1-based segments (e.g. `2:5`), matching `texts.path`,
 * `translations.path`, and `media_attachment.path`.
 */

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
