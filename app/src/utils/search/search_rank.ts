import Fuse from 'fuse.js';

export type SearchRankKey = {
  name: string;
  /** Higher weight pulls a match in that field ahead of a match in a lighter field. */
  weight: number;
};

/**
 * Orders an already-filtered list by Fuse score. Does not add or remove rows:
 * `threshold: 1` asks Fuse to score every item, and anything it skips stays at
 * the end in the original order.
 */
export const order_by_relevance = <T>(
  items: readonly T[],
  query: string,
  keys: readonly SearchRankKey[],
  get_fields: (item: T) => Record<string, string>
): T[] => {
  if (!query.trim() || items.length < 2) return [...items];

  const records = items.map((item, index) => ({
    index,
    item,
    ...get_fields(item)
  }));

  const fuse = new Fuse(records, {
    keys: keys.map((key) => ({ name: key.name, weight: key.weight })),
    includeScore: true,
    shouldSort: true,
    threshold: 1,
    ignoreLocation: true,
    ignoreDiacritics: true,
    minMatchCharLength: 1,
    findAllMatches: true
  });

  const hits = fuse.search(query);
  const rank = new Map<number, number>();
  hits.forEach((hit, position) => {
    rank.set(hit.item.index, position);
  });

  return records
    .slice()
    .sort((a, b) => {
      const left = rank.get(a.index) ?? hits.length;
      const right = rank.get(b.index) ?? hits.length;
      if (left !== right) return left - right;
      return a.index - b.index;
    })
    .map((record) => record.item);
};
