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
  if (isDataRequest) return;
  const project_key_ = project_keys_enum_schema.safeParse(params.project_key);
  if (!project_key_.success) {
    error(404, `Not found`);
  }
  const project_key = project_key_.data;
  const project_info = get_project_info_from_key(project_key);
  const { levels, level_names } = project_info;
  const { first, second } = params_schema.parse(params);

  let text: shloka_list_type | undefined = undefined;

  if (levels === 1) {
    if (first || second) {
      error(404, `Not found`);
    }
    text = await get_text_data_func(project_key, []);
  } else if (levels === 2) {
    if (first) {
      const text_map = await project_info.map_info();
      text = await get_text_data_func(project_key, [first]);
    }
  } else if (levels === 3) {
    if (first) {
      if (second) {
        text = await get_text_data_func(project_key, [first, second]);
      }
    }
  }
  return {
    text
  };
};
