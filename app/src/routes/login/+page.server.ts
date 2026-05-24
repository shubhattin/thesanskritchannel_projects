import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { user_info } = await parent();
  if (user_info) redirect(307, '/');
};
