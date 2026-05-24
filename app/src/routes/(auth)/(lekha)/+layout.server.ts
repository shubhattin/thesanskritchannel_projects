import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { get_user_app_scope_status } from '~/utils/app_scope_utils';
import { APP_SCOPE_ID_LEKHA } from '~/state/data_types';

export const load: LayoutServerLoad = async ({ parent, request }) => {
  const { user_info } = await parent();
  if (user_info!.role === 'admin')
    return {
      is_lekha_scope_allowed: true
    };
  const cookie = request.headers.get('cookie') ?? '';
  const is_current_app_scope = await get_user_app_scope_status(
    user_info!.id,
    APP_SCOPE_ID_LEKHA,
    cookie
  );
  return {
    is_lekha_scope_allowed: is_current_app_scope
  };
};
