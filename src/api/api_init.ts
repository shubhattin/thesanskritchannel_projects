import { auth } from '~/lib/auth';

export const protected_route_check = async (headers: Headers) => {
  const session = await auth.api.getSession({
    headers: headers
  });
  const user = session?.user;
  if (!user) return null;
  return user;
};

export const protected_admin_route_check = async (headers: Headers) => {
  const user = await protected_route_check(headers);
  if (!user || user.role !== 'admin') return null;
  return user;
};
