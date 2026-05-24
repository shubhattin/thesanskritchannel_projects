import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
  const { user_info } = await parent();
  if (!user_info) redirect(307, '/login');
};
