import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { projects } from '$app/db/schema';
import {
  clear_server_project_info_cache,
  clear_server_project_map_cache
} from '$app/utils/project/list.server';
import { db } from '~/db/site_db';
import { get_session_from_cookie } from '~/lib/get_auth_from_cookie';

export const GET: APIRoute = async ({ request, params }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const session = await get_session_from_cookie(cookie);
  if (!session?.user || session.user.role !== 'admin') {
    return new Response(null, { status: 401 });
  }

  const project_id = Number(params.project_id);
  if (!Number.isInteger(project_id) || project_id < 1) {
    return new Response(null, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, project_id),
    columns: { key: true }
  });
  if (!project) {
    return new Response(null, { status: 404 });
  }

  clear_server_project_map_cache(project_id);
  clear_server_project_info_cache(project.key);
  return new Response(null, { status: 204 });
};
