import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  get_level_names_from_map,
  get_levels_from_map,
  get_project_from_key,
  project_keys_enum_schema
} from '~/state/project_list';
import { z } from 'zod';
import { get_text_data_func } from '~/api/routes/text';
import type { shloka_list_type } from '~/state/data_types';

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
  const { params, isDataRequest } = opts;
  const project_key_ = project_keys_enum_schema.safeParse(params.project_key);
  if (!project_key_.success) {
    error(404, `Not found`);
  }
  const project_key = project_key_.data;
  const project = get_project_from_key(project_key);
  const project_map = await project.get_map();
  const levels = get_levels_from_map(project_map);
  const level_names = get_level_names_from_map(project_map).slice(0, levels);
  const path_params = parse_path_params(params.path);

  let text: shloka_list_type | undefined = undefined;
  let list_count: number | null = null;
  let path_names: (string | undefined)[] = [];

  if (path_params.length > levels - 1) {
    error(404, `Not found`);
  }

  if (levels === 1) {
    text = await get_text_data_func(project_key, []);
  } else if (path_params.length > 0) {
    // Traverse dynamic map for names and validation.
    let node: any = project_map;
    for (let i = 0; i < path_params.length; i++) {
      if (node?.info?.type !== 'list') {
        error(404, `Not found`);
      }
      const list: any[] = node.list ?? [];
      const sel = path_params[i]!;
      const level_name = level_names[levels - 1 - i] ?? 'Level';
      if (!(sel >= 1 && sel <= list.length)) {
        error(404, `${level_name} Not found`);
      }
      if (i === path_params.length - 1) list_count = list.length;
      node = list[sel - 1];
      path_names.push(node?.name_dev);
    }

    // Only fetch text when the selection is complete (leaf list selected).
    if (path_params.length === levels - 1 && !isDataRequest) {
      text = await get_text_data_func(project_key, path_params);
    }
  }
  return {
    project_key,
    levels,
    level_names,
    path_params,
    path_names,
    text,
    list_count
  };
};
