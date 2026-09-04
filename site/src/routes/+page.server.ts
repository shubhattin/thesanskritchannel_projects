import { getProjectList } from '@app/effect/project_registry';
import { CACHE, NO_CACHE_PARAMS } from '@app/effect/cache_loaders';
import { runServerEffectOr } from '~/effect/site_runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const [projects, latest_lekhas] = await Promise.all([
    runServerEffectOr(getProjectList({ listed_only: true }), []),
    runServerEffectOr(CACHE.site_lekha_list.get(NO_CACHE_PARAMS), [])
  ]);

  return {
    projects,
    featured_projects: projects.slice(0, 10),
    latest_lekhas
  };
};
