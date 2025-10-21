import type { LayoutServerLoad } from './$types'; // Adjust the path based on your project structure
import { get_user_app_scope_status } from '~/api/trpc_init';
import get_seesion_from_cookie from '~/lib/get_auth_from_cookie';

export const load: LayoutServerLoad = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const session = await get_seesion_from_cookie(cookie);
  const is_current_app_scope = session
    ? await get_user_app_scope_status(session.user.id).catch(() => false)
    : false;
  return {
    user_info: session?.user, // This can be undefined if the user is not authenticated
    is_current_app_scope
  };
};
