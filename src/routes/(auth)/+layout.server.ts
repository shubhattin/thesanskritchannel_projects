import { auth } from '~/lib/auth';
import type { LayoutServerLoad } from './$types'; // Adjust the path based on your project structure
import { CURRENT_APP_SCOPE } from '~/state/data_types';
import { get_user_app_scope } from '~/api/trpc_init';

export const load: LayoutServerLoad = async ({ request }) => {
  const session = await auth.api.getSession({
    headers: request.headers
  });
  const is_current_app_scope = session
    ? await get_user_app_scope(session.user.id, CURRENT_APP_SCOPE)
    : false;
  return {
    user_info: session?.user, // This can be undefined if the user is not authenticated
    is_current_app_scope
  };
};
