import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { projects } from '$app/db/schema';
import { dbRun } from '$app/effect/database';
import {
  clearServerProjectInfoCache,
  clearServerProjectMapCache
} from '$app/effect/project_registry';
import { BadRequestError, NotFoundError, UnauthorizedError } from '$app/effect/errors';
import { get_session_from_cookie } from '~/lib/get_auth_from_cookie';
import { runRouteEffect } from '~/effect/site_runtime';

export const GET: APIRoute = async ({ request, params }) =>
  runRouteEffect(
    Effect.gen(function* () {
      const cookie = request.headers.get('cookie') ?? '';
      const session = yield* get_session_from_cookie(cookie);
      if (!session?.user || session.user.role !== 'admin') {
        return yield* Effect.fail(UnauthorizedError.make({ message: 'Admin required' }));
      }

      const project_id = Number(params.project_id);
      if (!Number.isInteger(project_id) || project_id < 1) {
        return yield* Effect.fail(BadRequestError.make({ message: 'Invalid project id' }));
      }

      const project = yield* dbRun('cache.invalidate_project_map.lookup', (db) =>
        db.query.projects.findFirst({
          where: eq(projects.id, project_id),
          columns: { key: true }
        })
      );
      if (!project) {
        return yield* Effect.fail(
          NotFoundError.make({ resource: 'project', message: `Project ${project_id} not found` })
        );
      }

      clearServerProjectMapCache(project_id);
      clearServerProjectInfoCache(project.key);
      return null;
    }),
    {
      onSuccess: () => new Response(null, { status: 204 })
    }
  );
