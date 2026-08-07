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
    return yield* Effect.promise(async () => {
      try {
        const res = await fetch(`${url}/api/auth/get-session`, {
          method: 'GET',
          headers: { Cookie: cookie }
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch session: ${res.statusText}`);
        }
        return (await res.json()) as Session;
      } catch {
        return null;
      }
    });
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
    return yield* Effect.promise(async () => {
      const res = await fetch(`${url}/api/jwt/verify?token=${token}`, {
        method: 'GET'
      });
      if (!res.ok) return null;
      const data = await res.json();
      const data_parse = jwt_response_schema.safeParse(data);
      if (!data_parse.success) return null;
      return data_parse.data;
    });
  });
