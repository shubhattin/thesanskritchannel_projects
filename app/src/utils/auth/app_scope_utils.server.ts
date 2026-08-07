import { getAppPublicConfig } from '~/effect/app_runtime.server';
import type { APP_SCOPE_IDENTIFIERS } from '~/state/data_types';
import { fetch_get } from '~/tools/fetch';

export const get_user_app_scope_status = async (
  user_id: string,
  scope_name: keyof typeof APP_SCOPE_IDENTIFIERS,
  cookie?: string
) => {
  const { betterAuthUrl } = getAppPublicConfig();
  const res = await fetch_get(`${betterAuthUrl}/api/app_scope/get_user_app_scope_status`, {
    params: {
      user_id,
      scope_name
    },
    ...(cookie
      ? { headers: { Cookie: cookie } }
      : { credentials: 'include' satisfies RequestCredentials })
  });
  if (!res.ok) return false;
  return (await res.json()) ?? false;
};
