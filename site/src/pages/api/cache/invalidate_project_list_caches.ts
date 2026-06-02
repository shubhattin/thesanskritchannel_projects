import type { APIRoute } from 'astro';
import { clear_project_registry_cache } from '$app/server/project_list.server';
import { verify_jwt_token } from '~/lib/get_auth_from_cookie';

export const GET: APIRoute = async ({ request }) => {
  const jwt_token = new URL(request.url).searchParams.get('jwt_token');
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
