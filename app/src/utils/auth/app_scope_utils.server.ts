import { Effect } from 'effect';
import type { APP_SCOPE_IDENTIFIERS } from '~/state/data_types';
import { fetch_get } from '~/tools/fetch';
import { AppPublicConfig } from '~/effect/config';

export const get_user_app_scope_status = (
  user_id: string,
  scope_name: keyof typeof APP_SCOPE_IDENTIFIERS,
  cookie?: string
) =>
  Effect.gen(function* () {
    const { betterAuthUrl } = yield* AppPublicConfig;
    return yield* Effect.tryPromise(async () => {
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
      return ((await res.json()) as boolean | null) ?? false;
    }).pipe(Effect.orElseSucceed(() => false));
  });
