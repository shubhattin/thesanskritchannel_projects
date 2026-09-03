import { Effect } from 'effect';
import type { RequestHandler } from './$types';
import { clearProjectRegistryCache } from '@app/effect/project_registry';
import { UnauthorizedError } from '@app/effect/errors';
import { get_session_from_cookie } from '~/lib/get_auth_from_cookie';
import { runRouteEffect } from '~/effect/site_runtime';

export const GET: RequestHandler = async ({ request }) =>
  runRouteEffect(
    Effect.gen(function* () {
      const cookie = request.headers.get('cookie') ?? '';
      const session = yield* get_session_from_cookie(cookie);
      if (!session?.user || session.user.role !== 'admin') {
        return yield* Effect.fail(UnauthorizedError.make({ message: 'Admin required' }));
      }
      clearProjectRegistryCache();
      return null;
    }),
    {
      onSuccess: () => new Response(null, { status: 204 })
    }
  );
