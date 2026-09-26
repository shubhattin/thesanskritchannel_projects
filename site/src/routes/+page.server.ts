import { getProjectList } from '@app/effect/project_registry';
import { runServerEffectOr } from '~/effect/site_runtime';
import { load_latest_lekhas } from '$lib/lekha/load-lekha.server';
import { maybe_transliterate_list } from '$lib/main_text/script-display.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { script_id } = await parent();
  const [projects, latest_lekhas] = await Promise.all([
    runServerEffectOr(getProjectList({ listed_only: true }), []),
    load_latest_lekhas(script_id)
  ]);
  const featured_projects = projects.slice(0, 10);
  const featured_name_devs_display = await maybe_transliterate_list(
    featured_projects.map((project) => project.name_dev),
    script_id
  );

  return {
    projects,
    featured_projects,
    featured_name_devs_display,
    ssr_script_id: script_id,
    latest_lekhas: latest_lekhas.slice(0, 5)
  };
};
