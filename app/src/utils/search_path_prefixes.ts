/** No path filter — search all paths in the selected project(s). */
export const normalize_search_path_prefixes = (
  path_prefixes: number[][] | undefined | null
): number[][] | undefined => {
  if (!path_prefixes?.length) return undefined;
  const filtered = path_prefixes.filter((pp) => pp.length > 0);
  return filtered.length > 0 ? filtered : undefined;
};
