import { Effect } from 'effect';
import { z } from 'zod';
import { SharedConfig } from '@app/effect/config';

/** Minimal session shape used by site cache-invalidate admin checks. */
export type SiteAuthSession = {
  user: {
    id: string;
    email: string;
    role?: string | null;
  };
};

/** Fetch Better Auth session from cookie. Run only at a framework boundary. */
export const get_session_from_cookie = (
  cookie: string,
  betterAuthUrl?: string
): Effect.Effect<SiteAuthSession | null, never, SharedConfig> =>
  Effect.gen(function* () {
    const url = betterAuthUrl ?? (yield* SharedConfig).betterAuthUrl;
    return yield* Effect.tryPromise(async () => {
      const res = await fetch(`${url}/api/auth/get-session`, {
        method: 'GET',
        headers: { Cookie: cookie }
      });
      if (!res.ok) return null;
      const data_parse = session_response_schema.safeParse(await res.json());
      return data_parse.success ? data_parse.data : null;
    }).pipe(Effect.orElseSucceed(() => null));
  });

const session_response_schema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    role: z.string().nullable().optional()
  })
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
