import { defineMiddleware } from 'astro:middleware';
import { withPublicPageCacheHeaders } from '~/lib/cache_headers';
import { runWithSiteRuntime } from '~/effect/site_runtime';

/**
 * One Effect ManagedRuntime per Worker request. Sharing a process-wide runtime
 * lets fibers settle after the creating request finished, which Cloudflare
 * cancels — and can hang the next request.
 */
export const onRequest = defineMiddleware((context, next) =>
  runWithSiteRuntime(async () => {
    const response = await next();
    return withPublicPageCacheHeaders(context.request, response);
  })
);
