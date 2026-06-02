import type { APIRoute } from 'astro';
import { clear_project_registry_cache } from '$app/server/project_list.server';
import { verify_jwt_token } from '~/lib/get_auth_from_cookie';

export const GET: APIRoute = async ({ request }) => {
  // extarct jwt_token from path query
  const jwt_token = request.url.split('?')[1].split('=')[1];
  if (!jwt_token) {
    return new Response(null, { status: 400 });
  }
  const valid = await verify_jwt_token(jwt_token);
  if (!valid || valid.payload.role !== 'admin') {
    return new Response(null, { status: 401 });
  }

  clear_project_registry_cache();
  return new Response(null, { status: 204 });
};
