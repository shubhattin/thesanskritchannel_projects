import type { PageServerLoad } from './$types';
import { load_text_route } from '$lib/main_text/load-text-route.server';

export const load: PageServerLoad = async ({ params, url, parent }) => {
  const { lang_id, script_id } = await parent();
  return load_text_route({
    key: params.key,
    slug: [],
    pathname: url.pathname,
    lang_id,
    script_id
  });
};
