import { Effect } from 'effect';
import type { authClient } from '$lib/auth-client';
import { z } from 'zod';
import { AppPublicConfig } from '~/effect/config';

type Session = typeof authClient.$Infer.Session;

/** Fetch Better Auth session from cookie. Run only at a framework boundary. */
export const get_session_from_cookie = (
  cookie: string,
  betterAuthUrl?: string
): Effect.Effect<Session | null, never, AppPublicConfig> =>
  Effect.gen(function* () {
    const url = betterAuthUrl ?? (yield* AppPublicConfig).betterAuthUrl;
    return yield* Effect.tryPromise(async () => {
      const res = await fetch(`${url}/api/auth/get-session`, {
        method: 'GET',
        headers: { Cookie: cookie }
      });
      if (!res.ok) return null;
      return (await res.json()) as Session;
    }).pipe(Effect.orElseSucceed(() => null));
  });

const jwt_response_schema = z.object({
  valid: z.boolean(),
  payload: z.object({
    email: z.string(),
    sub: z.string(),
    role: z.string()
  })
});

export const verify_jwt_token = (token: string, betterAuthUrl?: string) =>
  Effect.gen(function* () {
    const url = betterAuthUrl ?? (yield* AppPublicConfig).betterAuthUrl;
    return yield* Effect.tryPromise(async () => {
      const res = await fetch(`${url}/api/jwt/verify/?token=${encodeURIComponent(token)}`, {
        method: 'GET'
      });
      if (!res.ok) return null;
      const data_parse = jwt_response_schema.safeParse(await res.json());
      return data_parse.success ? data_parse.data : null;
    }).pipe(Effect.orElseSucceed(() => null));
  });

export default get_session_from_cookie;
