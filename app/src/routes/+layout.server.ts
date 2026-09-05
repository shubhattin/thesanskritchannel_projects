import type { LayoutServerLoad } from './$types';
import get_session_from_cookie from '~/lib/get_auth_from_cookie';
import { runServerEffect } from '~/effect/app_runtime.server';

export const load: LayoutServerLoad = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const session = await runServerEffect(get_session_from_cookie(cookie));

  return {
    user_info: session?.user
  };
};
