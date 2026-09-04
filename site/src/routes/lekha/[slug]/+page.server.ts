import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { load_lekha_entry } from '$lib/lekha/load-lekha.server';

export const load: PageServerLoad = async ({ params, parent }) => {
  const { script_id } = await parent();
  const entry = await load_lekha_entry(params.slug, script_id);
  if (!entry) {
    error(404, 'Not found');
  }
  return { entry };
};
