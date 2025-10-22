import get_seesion_from_cookie from '$lib/get_auth_from_cookie';

export const protected_route_check = async (headers: Headers) => {
  const cookie = headers.get('cookie') ?? '';
  const session = await get_seesion_from_cookie(cookie);
  const user = session?.user;
  if (!user) return null;
  return user;
};

export const protected_admin_route_check = async (headers: Headers) => {
  const user = await protected_route_check(headers);
  if (!user || user.role !== 'admin') return null;
  return user;
};
