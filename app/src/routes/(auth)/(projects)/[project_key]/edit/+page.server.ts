import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { resolve_project_by_key } from '~/utils/project/list.server';

export const load: PageServerLoad = async ({ parent, params }) => {
  const { user_info } = await parent();
  const project_key = params.project_key;
  if (!user_info || user_info.role !== 'admin') redirect(307, '/' + project_key);

  const resolved = await resolve_project_by_key(project_key, cache_db_options_app);
  if (!resolved) error(404, 'Not found');

  if (resolved.was_redirect) {
    redirect(301, `/${resolved.project.key}/edit`);
  }

  return {
    project_key: resolved.project.key,
    project_name_dev: resolved.project.name_dev
  };
};
