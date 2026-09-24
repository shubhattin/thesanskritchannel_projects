import type { PageServerLoad } from './$types';
import { load_lekha_list } from '$lib/lekha/load-lekha.server';

export const load: PageServerLoad = async ({ parent }) => {
  const { script_id } = await parent();
  const posts = await load_lekha_list(script_id);
  return { posts };
};
