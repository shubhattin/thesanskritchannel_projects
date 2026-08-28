import { Effect } from 'effect';
import type { authClient } from '$app/lib/auth-client';
import { z } from 'zod';
import { SharedConfig } from '$app/effect/config';

type Session = typeof authClient.$Infer.Session;

/** Fetch Better Auth session from cookie. Run only at a framework boundary. */
export const get_session_from_cookie = (
  cookie: string,
  betterAuthUrl?: string
): Effect.Effect<Session | null, never, SharedConfig> =>
  Effect.gen(function* () {
    const url = betterAuthUrl ?? (yield* SharedConfig).betterAuthUrl;
    return yield* Effect.tryPromise(async () => {
      const res = await fetch(`${url}/api/auth/get-session`, {
        method: 'GET',
        headers: { Cookie: cookie }
      });
      if (!res.ok) return null;
      // SAFETY: `${url}/api/auth/get-session` is Better Auth's session endpoint;
      // for a valid cookie it responds 200 with a `Session` JSON body. Non-OK
      // responses return null above, and transport failures are swallowed by the
      // `orElseSucceed` below, so only a well-formed session body reaches here.
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
    const url = betterAuthUrl ?? (yield* SharedConfig).betterAuthUrl;
    return yield* Effect.tryPromise(async () => {
      const res = await fetch(`${url}/api/jwt/verify?token=${encodeURIComponent(token)}`, {
        method: 'GET'
      });
      if (!res.ok) return null;
      const data_parse = jwt_response_schema.safeParse(await res.json());
      return data_parse.success ? data_parse.data : null;
    }).pipe(Effect.orElseSucceed(() => null));
  });
