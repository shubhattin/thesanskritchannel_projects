import type { authClient } from '$app/lib/auth-client';

export const get_session_from_cookie = async (cookie: string) => {
  try {
    const res = await fetch(`${import.meta.env.VITE_BETTER_AUTH_URL}/api/auth/get-session`, {
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
