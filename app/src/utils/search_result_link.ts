import { dbPathToPathParams } from '~/utils/map_path/swap';

const path_params_from_db = (db_path: string): number[] => {
  if (!db_path) return [];
  return dbPathToPathParams(db_path);
};

export const build_search_result_href = (
  project_key: string,
  db_path: string,
  line_index: number
): string => {
  const segments = path_params_from_db(db_path);
  const base = segments.length === 0 ? `/${project_key}` : `/${project_key}/${segments.join('/')}`;
  return `${base}#L-${line_index}`;
};
