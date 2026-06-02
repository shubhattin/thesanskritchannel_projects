import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { cache_db_options_app } from '~/server/cache_db_options';
import { get_project_by_key } from '~/server/project_list.server';

export const load: PageServerLoad = async ({ parent, params }) => {
  const { user_info } = await parent();
  const project_key = params.project_key;
  if (!user_info || user_info.role !== 'admin') redirect(307, '/' + project_key);

  const project = await get_project_by_key(project_key, cache_db_options_app);
  if (!project) error(404, 'Not found');

  return {
    project_key,
    project_name_dev: project.name_dev,
  };
};
