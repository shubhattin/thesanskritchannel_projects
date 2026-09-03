import { LANG_ID_COOKIE_NAME, SCRIPT_ID_COOKIE_NAME } from './cookies';

/** Anonymous HTML at the edge. Personalized script/lang views stay private. */
export const PUBLIC_PAGE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';
export const PRIVATE_NO_STORE = 'private, no-store';

const PERSONALIZATION_COOKIES = [LANG_ID_COOKIE_NAME, SCRIPT_ID_COOKIE_NAME] as const;

export const requestHasPersonalizationCookie = (cookieHeader: string | null): boolean => {
  if (!cookieHeader) return false;
  return PERSONALIZATION_COOKIES.some(
    (name) => cookieHeader.includes(`${name}=`) && !cookieHeader.includes(`${name}=;`)
  );
};

export const isCacheablePageRequest = (request: Request): boolean => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const path = new URL(request.url).pathname;
  return !path.startsWith('/api/');
};

export const cacheControlFor = (request: Request, status: number): string => {
  if (!isCacheablePageRequest(request)) return PRIVATE_NO_STORE;
  if (status !== 200) return PRIVATE_NO_STORE;
  if (requestHasPersonalizationCookie(request.headers.get('cookie'))) return PRIVATE_NO_STORE;
  return PUBLIC_PAGE_CACHE_CONTROL;
};

/** Overlay Cache-Control unless the handler already set one. */
export const withPublicPageCacheHeaders = (request: Request, response: Response): Response => {
  if (response.headers.has('Cache-Control')) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', cacheControlFor(request, response.status));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
