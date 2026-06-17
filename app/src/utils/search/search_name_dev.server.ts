import type { recursive_list_type } from '~/state/data_types';
import { remove_vedic_svara_chihnAni } from '~/utils/normalize_text';
import { dbPathMatchesPrefix } from '~/utils/map_path/swap';

export type NameDevSearchMatch = {
  project_id: number;
  path: string;
  index: null;
  shloka_num: null;
  text: string;
};

const db_path_matches_any_prefix = (db_path: string, path_prefixes?: number[][]): boolean => {
  if (!path_prefixes?.length) return true;
  return path_prefixes.some((pp) => {
    const prefix = pp.join(':');
    return dbPathMatchesPrefix(db_path, prefix);
  });
};

const name_dev_matches_query = (name_dev: string, search_text: string): boolean => {
  const query = remove_vedic_svara_chihnAni(search_text.trim());
  if (!query) return false;
  return remove_vedic_svara_chihnAni(name_dev).includes(query);
};

const collect_name_dev_matches = (
  map: recursive_list_type,
  project_id: number,
  search_text: string,
  path_prefixes: number[][] | undefined,
  path_params: number[] = []
): NameDevSearchMatch[] => {
  const results: NameDevSearchMatch[] = [];
  const db_path = path_params.join(':');

  if (
    db_path_matches_any_prefix(db_path, path_prefixes) &&
    name_dev_matches_query(map.name_dev, search_text)
  ) {
    results.push({
      project_id,
      path: db_path,
      index: null,
      shloka_num: null,
      text: map.name_dev
    });
  }

  if (map.info.type !== 'list') return results;

  for (let i = 0; i < (map.list ?? []).length; i++) {
    results.push(
      ...collect_name_dev_matches(map.list![i]!, project_id, search_text, path_prefixes, [
        ...path_params,
        i + 1
      ])
    );
  }

  return results;
};

const compare_name_dev_matches = (a: NameDevSearchMatch, b: NameDevSearchMatch) => {
  if (a.project_id !== b.project_id) return a.project_id - b.project_id;
  if (a.path !== b.path) return a.path.localeCompare(b.path, undefined, { numeric: true });
  return a.text.localeCompare(b.text);
};

export const search_name_dev_in_maps = (args: {
  projects: readonly { id: number; map: recursive_list_type }[];
  search_text: string;
  path_prefixes?: number[][];
  limit: number;
  offset: number;
}) => {
  const { projects, search_text, path_prefixes, limit, offset } = args;
  const all_matches = projects
    .flatMap(({ id, map }) => collect_name_dev_matches(map, id, search_text, path_prefixes))
    .sort(compare_name_dev_matches);

  const totalCount = all_matches.length;
  const items = all_matches.slice(offset, offset + limit);
  const hasMore = offset + limit < totalCount;

  return {
    items,
    page: {
      limit,
      offset,
      nextOffset: hasMore ? offset + limit : null,
      hasMore,
      totalCount
    }
  };
};
