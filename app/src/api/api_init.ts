import { Effect } from 'effect';
import get_session_from_cookie from '$lib/get_auth_from_cookie';
import type { authClient } from '$lib/auth-client';
import type { AppPublicConfig } from '~/effect/config';

type User = typeof authClient.$Infer.Session.user;

export const protected_route_check = (
  headers: Headers
): Effect.Effect<User | null, never, AppPublicConfig> =>
  Effect.gen(function* () {
    const cookie = headers.get('cookie') ?? '';
    const session = yield* get_session_from_cookie(cookie);
    return session?.user ?? null;
  });

export const protected_admin_route_check = (
  headers: Headers
): Effect.Effect<User | null, never, AppPublicConfig> =>
  Effect.gen(function* () {
    const user = yield* protected_route_check(headers);
    if (!user || user.role !== 'admin') return null;
    return user;
  });
