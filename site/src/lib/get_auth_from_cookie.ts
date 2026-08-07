import type { authClient } from '$app/lib/auth-client';
import { z } from 'zod';
import { getSiteBetterAuthUrl } from '~/effect/site_runtime';

export const get_session_from_cookie = async (cookie: string, betterAuthUrl?: string) => {
  try {
    const url = betterAuthUrl ?? getSiteBetterAuthUrl();
    const res = await fetch(`${url}/api/auth/get-session`, {
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
  } catch {
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

export const verify_jwt_token = async (token: string, betterAuthUrl?: string) => {
  const url = betterAuthUrl ?? getSiteBetterAuthUrl();
  const res = await fetch(`${url}/api/jwt/verify?token=${token}`, {
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
