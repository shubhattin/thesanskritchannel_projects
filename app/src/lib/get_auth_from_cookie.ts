import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
import type { authClient } from '$lib/auth-client';
import { z } from 'zod';

const get_session_from_cookie = async (cookie: string) => {
  try {
    const res = await fetch(`${PUBLIC_BETTER_AUTH_URL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        Cookie: cookie
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch session: ${res.statusText}`);
    }
    const session = (await res.json()) as typeof authClient.$Infer.Session;
    return session;
  } catch (e) {
    return null;
  }
};

const jwt_response_schema = z.object({
  valid: z.boolean(),
  payload: z.object({
    email: z.string(),
    sub: z.string(),
    role: z.string()
  })
});
export const verify_jwt_token = async (token: string) => {
  const res = await fetch(`${PUBLIC_BETTER_AUTH_URL}/api/jwt/verify/?token=${token}`, {
    method: 'GET'
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const data_parse = jwt_response_schema.safeParse(data);
  if (!data_parse.success) {
    return null;
  }
  return data_parse.data;
};

export default get_session_from_cookie;
