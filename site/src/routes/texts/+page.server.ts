import { getProjectList } from '@app/effect/project_registry';
import { maybe_transliterate_list } from '$lib/main_text/script-display.server';
import { runServerEffectOr } from '~/effect/site_runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { script_id } = await parent();
  const projects = await runServerEffectOr(getProjectList({ listed_only: true }), []);
  const name_devs_display = await maybe_transliterate_list(
    projects.map((project) => project.name_dev),
    script_id
  );

  return { projects, ssr_script_id: script_id, name_devs_display };
};
