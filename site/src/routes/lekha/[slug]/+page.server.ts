import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { load_lekha_entry } from '$lib/lekha/load-lekha.server';

export const load: PageServerLoad = async ({ params, parent, url }) => {
  const { script_id } = await parent();
  const resolved = await load_lekha_entry(params.slug, script_id);
  if (!resolved) {
    error(404, 'Not found');
  }
  if (resolved.redirect_to && resolved.redirect_to !== url.pathname) {
    redirect(301, resolved.redirect_to);
  }
  return { entry: resolved.entry };
};
