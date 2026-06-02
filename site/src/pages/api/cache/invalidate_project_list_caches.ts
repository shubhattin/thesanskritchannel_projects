import type { APIRoute } from 'astro';
import { clear_project_registry_cache } from '$app/server/project_list.server';
import { require_admin_session } from '~/lib/require_admin_session';

export const POST: APIRoute = async ({ request }) => {
  const denied = await require_admin_session(request);
  if (denied) return denied;

  clear_project_registry_cache();
  return new Response(null, { status: 204 });
};
