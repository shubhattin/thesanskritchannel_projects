import type { PageServerLoad } from './$types';
import { load_lekha_list } from '$lib/lekha/load-lekha.server';

export const load: PageServerLoad = async () => {
  const posts = await load_lekha_list();
  return { posts };
};
