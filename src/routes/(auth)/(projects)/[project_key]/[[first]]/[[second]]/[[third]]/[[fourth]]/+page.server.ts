import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { project_keys_enum_schema, get_project_info_from_key } from '~/state/project_list';
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
  const project_info = get_project_info_from_key(project_key);
  const { levels, level_names } = project_info;
  // `project_info.levels` is currently typed as 1|2|3|5 in `PROJECT_INFO`,
  // but routes may temporarily exist for level-4 projects as well.
  const levels_num = levels as number;
  const { first, second, third, fourth } = params_schema.parse(params);

  let text: shloka_list_type | undefined = undefined;
  let first_name: string | undefined = undefined;
  let second_name: string | undefined = undefined;
  let third_name: string | undefined = undefined;
  let fourth_name: string | undefined = undefined;
  let list_count: number | undefined = undefined;

  // Validate path param shape early (no skipping levels, no extra levels).
  if (!first && (second || third || fourth)) error(404, `Not found`);
  if (!second && (third || fourth)) error(404, `Not found`);
  if (!third && fourth) error(404, `Not found`);
  if (levels_num < 5 && fourth) error(404, `Not found`);
  if (levels_num < 4 && third) error(404, `Not found`);
  if (levels_num < 3 && second) error(404, `Not found`);
  if (levels_num < 2 && first) error(404, `Not found`);

  if (levels === 1) {
    text = await get_text_data_func(project_key, []);
  } else if (levels === 2) {
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
  } else if (levels_num === 4) {
    if (first) {
      const text_map = await (project_info as any).map_info();
      if (!(first >= 1 && first <= text_map.length)) {
        error(404, `${level_names[3]} Not found`);
      }
      first_name = text_map[first - 1].name_dev;
      if (second) {
        const second_list = text_map[first - 1].list;
        if (!(second >= 1 && second <= second_list.length)) {
          error(404, `${level_names[2]} Not found`);
        }
        second_name = second_list[second - 1].name_dev;
        if (third) {
          const third_list = second_list[second - 1].list;
          if (!(third >= 1 && third <= third_list.length)) {
            error(404, `${level_names[1]} Not found`);
          }
          third_name = third_list[third - 1].name_dev;
          if (!isDataRequest) text = await get_text_data_func(project_key, [first, second, third]);
          list_count = third_list.length;
        }
      }
    }
  } else if (levels === 5) {
    if (first) {
      const text_map = await project_info.map_info();
      if (!(first >= 1 && first <= text_map.length)) {
        error(404, `${level_names[4]} Not found`);
      }
      first_name = text_map[first - 1].name_dev;
      if (second) {
        const second_list = text_map[first - 1].list;
        if (!(second >= 1 && second <= second_list.length)) {
          error(404, `${level_names[3]} Not found`);
        }
        second_name = second_list[second - 1].name_dev;
        if (third) {
          const third_list = second_list[second - 1].list;
          if (!(third >= 1 && third <= third_list.length)) {
            error(404, `${level_names[2]} Not found`);
          }
          third_name = third_list[third - 1].name_dev;
          if (fourth) {
            const fourth_list = third_list[third - 1].list;
            if (!(fourth >= 1 && fourth <= fourth_list.length)) {
              error(404, `${level_names[1]} Not found`);
            }
            fourth_name = fourth_list[fourth - 1].name_dev;
            if (!isDataRequest)
              text = await get_text_data_func(project_key, [first, second, third, fourth]);
            list_count = fourth_list.length;
          }
        }
      }
    }
  }
  return {
    project_key,
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
