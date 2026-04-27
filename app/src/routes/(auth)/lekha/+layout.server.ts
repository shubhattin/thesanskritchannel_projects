import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
  const { user_info } = await parent();
  if (!user_info) {
    redirect(307, '/login');
  }
  if (user_info.role !== 'admin') {
    redirect(307, '/');
  }
  return {
    user_info
  };
};
