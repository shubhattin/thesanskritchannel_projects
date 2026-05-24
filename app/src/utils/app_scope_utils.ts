import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
import type { APP_SCOPE_IDENTIFIERS } from '~/state/data_types';
import { fetch_get } from '~/tools/fetch';

export const get_user_app_scope_status = async (
  user_id: string,
  scope_name: keyof typeof APP_SCOPE_IDENTIFIERS,
  cookie?: string
) => {
  const res = await fetch_get(`${PUBLIC_BETTER_AUTH_URL}/api/app_scope/get_user_app_scope_status`, {
    params: {
      user_id,
      scope_name
    },
    ...(cookie ? { headers: { Cookie: cookie } } : { credentials: 'include' as RequestCredentials })
  });
  if (!res.ok) return false;
  return (await res.json()) ?? false;
};
