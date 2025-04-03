import { auth } from '~/lib/auth';

export const proteccted_route_check = async (headers: Headers) => {
  const session = await auth.api.getSession({
    headers: headers
  });
  const user = session?.user;
  if (!user || !user.is_approved) return null;
  return user;
};

export const protected_admin_route_check = async (headers: Headers) => {
  const user = await proteccted_route_check(headers);
  if (!user || user.role !== 'admin') return null;
  return user;
};
