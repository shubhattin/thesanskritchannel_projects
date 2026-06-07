import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  get_level_names_from_map,
  get_levels_from_map,
  get_list_name_for_path_param_index
} from '~/state/project_list';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { get_project_by_key, get_project_map_by_key } from '~/utils/project/list.server';
import { z } from 'zod';

const path_params_schema = z.array(z.coerce.number().int());

const parse_path_params = (path: string | undefined) => {
  if (!path) return [];
  let segments = path.split('/');
  if (segments.length === 1 && segments[0] === '') segments = [];
  if (segments.some((seg) => seg.trim().length === 0)) {
    error(404, `Not found`);
  }
  const parsed = path_params_schema.safeParse(segments);
  if (!parsed.success) {
    error(404, `Not found`);
  }
  return parsed.data;
};

export const load: PageServerLoad = async (opts) => {
  const { params } = opts;
  const project_key = params.project_key;
  const project = await get_project_by_key(project_key, cache_db_options_app);
  if (!project) error(404, 'Not found');
  const project_map = await get_project_map_by_key(project_key, cache_db_options_app);
  const levels = get_levels_from_map(project_map);
  const level_names = get_level_names_from_map(project_map).slice(0, levels);
  const path_params = parse_path_params(params.path);

  if (path_params.length > levels - 1) {
    error(404, `Not found`);
  }

  if (path_params.length > 0) {
    let node = project_map;
    for (let i = 0; i < path_params.length; i++) {
      if (node?.info?.type !== 'list') {
        error(404, `Not found`);
      }
      const list = node.list ?? [];
      const sel = path_params[i]!;
      const level_name = get_list_name_for_path_param_index(project_map, path_params, i, 'Level');
      if (!(sel >= 1 && sel <= list.length)) {
        error(404, `${level_name} Not found`);
      }
      node = list[sel - 1]!;
    }
  }

  return {
    project_key,
    levels,
    level_names,
    path_params
  };
};
