import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { get_user_app_scope_status } from '~/api/trpc_init';
import { APP_SCOPE_ID_PROJECT_PORTAL } from '~/state/data_types';

export const load: LayoutServerLoad = async ({ parent }) => {
  const { user_info } = await parent();

};
