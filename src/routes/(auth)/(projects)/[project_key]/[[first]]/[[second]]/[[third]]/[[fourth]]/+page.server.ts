import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  clamp_levels_for_route,
  get_level_names_from_map,
  get_levels_from_map,
  get_project_from_key,
  project_keys_enum_schema
} from '~/state/project_list';
import { z } from 'zod';
import { get_text_data_func } from '~/api/routes/text';
import type { shloka_list_type } from '~/state/data_types';

const params_schema = z.object({
  first: z.coerce.number().int().optional(),
  second: z.coerce.number().int().optional(),
  third: z.coerce.number().int().optional(),
  fourth: z.coerce.number().int().optional()
});

export const load: PageServerLoad = async (opts) => {
  const { params, isDataRequest } = opts;
  const project_key_ = project_keys_enum_schema.safeParse(params.project_key);
  if (!project_key_.success) {
    error(404, `Not found`);
  }
  const project_key = project_key_.data;
  const project = get_project_from_key(project_key);
  const project_map = await project.get_map();
  const levels = clamp_levels_for_route(get_levels_from_map(project_map));
  const level_names = get_level_names_from_map(project_map).slice(0, levels);
  const { first, second, third, fourth } = params_schema.parse(params);

  let text: shloka_list_type | undefined = undefined;
  let first_name: string | undefined = undefined;
  let second_name: string | undefined = undefined;
  let third_name: string | undefined = undefined;
  let fourth_name: string | undefined = undefined;
  let list_count: number | null = null;

  // Validate path param shape early (no skipping levels, no extra levels).
  if (!first && (second || third || fourth)) error(404, `Not found`);
  if (!second && (third || fourth)) error(404, `Not found`);
  if (!third && fourth) error(404, `Not found`);

  const raw_params = [first, second, third, fourth];
  const path_params = raw_params.filter((v): v is number => typeof v === 'number');
  if (path_params.length > levels - 1) error(404, `Not found`);

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
      if (i === 0) first_name = node?.name_dev;
      else if (i === 1) second_name = node?.name_dev;
      else if (i === 2) third_name = node?.name_dev;
      else if (i === 3) fourth_name = node?.name_dev;
    }

    // Only fetch text when the selection is complete (leaf list selected).
    if (path_params.length === levels - 1 && !isDataRequest) {
      text = await get_text_data_func(project_key, path_params);
    }
  }
  // console.log(level_names);
  return {
    project_key,
    levels,
    level_names,
    first_name,
    first,
    second_name,
    second,
    third_name,
    third,
    fourth_name,
    fourth,
    text,
    list_count
  };
};
