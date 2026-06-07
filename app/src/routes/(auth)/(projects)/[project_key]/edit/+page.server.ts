import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { get_project_by_key_effect, runAppEffect } from '~/server/effect';

export const load: PageServerLoad = async ({ parent, params }) => {
  const { user_info } = await parent();
  const project_key = params.project_key;
  if (!user_info || user_info.role !== 'admin') redirect(307, '/' + project_key);

  const project = await runAppEffect(get_project_by_key_effect(project_key));
  if (!project) error(404, 'Not found');

  return {
    project_key,
    project_name_dev: project.name_dev
  };
};
