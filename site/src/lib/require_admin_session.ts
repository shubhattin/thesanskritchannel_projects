import { get_session_from_cookie } from './get_auth_from_cookie';

/** Returns an error Response when the request is not from an admin; otherwise null. */
export const require_admin_session = async (request: Request): Promise<Response | null> => {
  const cookie = request.headers.get('cookie') ?? '';
  const session = await get_session_from_cookie(cookie);
  if (!session?.user || session.user.role !== 'admin') {
    return new Response(null, { status: 401 });
  }
  return null;
};
