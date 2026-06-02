/**
 * Path swap helpers for the map index editor.
 * No DB imports — safe for unit tests. DB work lives in `project_map_path_swap.server.ts`.
 *
 * DB paths use colon-separated 1-based segments (e.g. `2:5`), matching `texts.path`,
 * `translations.path`, and `media_attachment.path`.
 */

/** Staging suffix for two-phase swaps (`1:2` → `1:2_temp` → `1:5`). */
export const PATH_TEMP_SUFFIX = '_temp';

const DB_PATH_SEGMENT_RE = /^[1-9]\d*$/;

/** One sibling swap from the client, applied in array order. */
export type PathSwapEdit = {
  swap_paths: [string, string];
};

/** Builds the intermediate path used before the final swap (avoids PK collisions). */
export function toTempDbPath(path: string): string {
  return `${path}${PATH_TEMP_SUFFIX}`;
}

/** Converts a DB path string to numeric segments for cache keys (`1:2` → `[1, 2]`). */
export function dbPathToPathParams(path: string): number[] {
  return path.split(':').map((s) => Number(s));
}

/** Returns an error message if `path` is not a valid DB path, or `null` if OK. */
export function validateDbPath(path: string): string | null {
  if (!path || path.includes(PATH_TEMP_SUFFIX)) {
    return 'Path must be a colon-separated list of positive integers (no _temp suffix)';
  }
  const segments = path.split(':');
  if (segments.some((seg) => !DB_PATH_SEGMENT_RE.test(seg))) {
    return 'Each path segment must be a positive integer';
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
    const [pathA, pathB] = edits[i]!.swap_paths;
    const err = validateSwapPair(pathA, pathB);
    if (err) return `Swap ${i + 1}: ${err}`;
  }

  return null;
}
