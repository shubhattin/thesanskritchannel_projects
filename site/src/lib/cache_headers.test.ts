import { describe, expect, it } from 'vitest';
import {
  cacheControlFor,
  PRIVATE_NO_STORE,
  PUBLIC_PAGE_CACHE_CONTROL,
  requestHasPersonalizationCookie,
  withPublicPageCacheHeaders
} from './cache_headers';

const htmlGet = (path: string, cookie?: string) =>
  new Request(`https://thesanskritchannel.org${path}`, {
    method: 'GET',
    headers: cookie ? { cookie } : undefined
  });

describe('cache headers', () => {
  it('caches anonymous GET 200 HTML at the edge', () => {
    expect(cacheControlFor(htmlGet('/'), 200)).toBe(PUBLIC_PAGE_CACHE_CONTROL);
    expect(cacheControlFor(htmlGet('/bhagavadgita/chapter-1'), 200)).toBe(
      PUBLIC_PAGE_CACHE_CONTROL
    );
  });

  it('does not cache personalized script/lang views', () => {
    expect(cacheControlFor(htmlGet('/', 'site_script_id=3'), 200)).toBe(PRIVATE_NO_STORE);
    expect(cacheControlFor(htmlGet('/bhagavadgita/chapter-1', 'site_lang_id=2'), 200)).toBe(
      PRIVATE_NO_STORE
    );
  });

  it('does not cache API, mutations, or errors', () => {
    expect(cacheControlFor(htmlGet('/api/cache/invalidate_project_list_caches'), 200)).toBe(
      PRIVATE_NO_STORE
    );
    expect(cacheControlFor(new Request('https://example.com/', { method: 'POST' }), 200)).toBe(
      PRIVATE_NO_STORE
    );
    expect(cacheControlFor(htmlGet('/missing'), 404)).toBe(PRIVATE_NO_STORE);
  });

  it('detects personalization cookies without treating empty pairs as set', () => {
    expect(requestHasPersonalizationCookie(null)).toBe(false);
    expect(requestHasPersonalizationCookie('theme=dark')).toBe(false);
    expect(requestHasPersonalizationCookie('site_script_id=1; other=1')).toBe(true);
  });

  it('leaves an existing Cache-Control header alone', () => {
    const request = htmlGet('/');
    const existing = new Response('ok', { headers: { 'Cache-Control': 'private, max-age=0' } });
    const next = withPublicPageCacheHeaders(request, existing);
    expect(next.headers.get('Cache-Control')).toBe('private, max-age=0');
  });
});
