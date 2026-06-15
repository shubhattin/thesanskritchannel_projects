import type { APIRoute } from 'astro';
import { clear_project_registry_cache } from '$app/utils/project/list.server';
import { get_session_from_cookie } from '~/lib/get_auth_from_cookie';

export const GET: APIRoute = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const session = await get_session_from_cookie(cookie);
  if (!session?.user || session.user.role !== 'admin') {
    return new Response(null, { status: 401 });
  }

  clear_project_registry_cache();
  return new Response(null, { status: 204 });
};
