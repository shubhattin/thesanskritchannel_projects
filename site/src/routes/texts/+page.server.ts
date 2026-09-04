import { getProjectList } from '@app/effect/project_registry';
import { runServerEffectOr } from '~/effect/site_runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const projects = await runServerEffectOr(getProjectList({ listed_only: true }), []);

  return { projects };
};
