import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { projects } from '$app/db/schema';
import {
  clear_server_project_info_cache,
  clear_server_project_map_cache
} from '$app/server/project_list.server';
import { db } from '~/db/site_db';
import { require_admin_session } from '~/lib/require_admin_session';

export const POST: APIRoute = async ({ request, params }) => {
  const denied = await require_admin_session(request);
  if (denied) return denied;

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
