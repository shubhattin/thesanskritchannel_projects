import { authClient } from '~/lib/auth-client';

const get_main_site_origin = () => {
  const url = import.meta.env.VITE_MAIN_SITE_URL;
  if (typeof url !== 'string') return '';
  return url.trim().replace(/\/$/, '');
};

const get_to_main_site = async (path: string, cookie: string) => {
  const origin = get_main_site_origin();
  if (!origin || !cookie) return;
  const jwt_token = (
    await authClient.token({
      fetchOptions: {
        headers: {
          Cookie: cookie
        }
      }
    })
  ).data?.token;
  if (!jwt_token) return;

  try {
    const res = await fetch(`${origin}${path}?jwt_token=${jwt_token}`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok && import.meta.env.PROD) {
      console.error(`Main site cache invalidation failed (${res.status}): ${path}`);
    }
  } catch (err) {
    if (import.meta.env.PROD) {
      console.error(`Main site cache invalidation request failed: ${path}`, err);
    }
  }
};

/** Clears in-memory project list/registry/map caches on the Astro reader site. */
export const notify_site_invalidate_project_list_caches = (cookie: string) =>
  get_to_main_site('/api/cache/invalidate_project_list_caches', cookie);

/** Clears in-memory project map/info caches for one project on the Astro reader site. */
export const notify_site_invalidate_project_map_cache = (cookie: string, project_id: number) =>
  get_to_main_site(`/api/cache/invalidate_project_map_cache/${project_id}`, cookie);
