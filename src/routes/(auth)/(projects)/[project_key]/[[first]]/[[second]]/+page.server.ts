import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { project_keys_enum_schema, get_project_info_from_key } from '~/state/project_list';
import { z } from 'zod';
import { get_text_data_func } from '~/api/routes/translation';
import type { shloka_list_type } from '~/state/data_types';

const params_schema = z.object({
  first: z.coerce.number().int().optional(),
  second: z.coerce.number().int().optional()
});

export const load: PageServerLoad = async (opts) => {
  const { params, isDataRequest } = opts;
  const project_key_ = project_keys_enum_schema.safeParse(params.project_key);
  if (!project_key_.success) {
    error(404, `Not found`);
  }
  const project_key = project_key_.data;
  const project_info = get_project_info_from_key(project_key);
  const { levels, level_names } = project_info;
  const { first, second } = params_schema.parse(params);

  let text: shloka_list_type | undefined = undefined;
  let first_name: string | undefined = undefined;
  let second_name: string | undefined = undefined;
  let list_count: number | undefined = undefined;

  if (levels === 1) {
    if (first || second) {
      error(404, `Not found`);
    }
  } else if (levels === 2) {
    if (first && second) {
      // if the first type is there then these arguments are not needed
      error(404, `Not found`);
    }
    if (first) {
      const text_map = await project_info.map_info();
      if (!(first >= 1 && first <= text_map.length)) {
        error(404, `${level_names[1]} Not found`);
      }
      first_name = text_map[first - 1].name_dev;
      if (!isDataRequest) text = await get_text_data_func(project_key, [first]);
      list_count = text_map.length;
    }
  } else if (levels === 3) {
    if (first) {
      const text_map = await project_info.map_info();
      if (!(first >= 1 && first <= text_map.length)) {
        error(404, `${level_names[2]} Not found`);
      }
      first_name = text_map[first - 1].name_dev;
      if (second) {
        const second_list = text_map[first - 1].list;
        if (!(second >= 1 && second <= second_list.length)) {
          error(404, `${level_names[1]} Not found`);
        }
        second_name = second_list[second - 1].name_dev;
        if (!isDataRequest) text = await get_text_data_func(project_key, [first, second]);
        list_count = second_list.length;
      }
    }
  }
  return {
    project_key,
    first_name,
    first,
    second_name,
    second,
    text,
    list_count
  };
};
