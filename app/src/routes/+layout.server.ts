import type { LayoutServerLoad } from './$types'; // Adjust the path based on your project structure
import get_session_from_cookie from '~/lib/get_auth_from_cookie';

export const load: LayoutServerLoad = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const session = await get_session_from_cookie(cookie);

  return {
    user_info: session?.user // This can be undefined if the user is not authenticated
  };
};
