import { Effect } from 'effect';
import { siteLekhaSlugMapCache } from './cache_loaders';
import { NO_CACHE_PARAMS } from './cache';

/** Same env as project_registry — site-safe (no AiProvider / ObjectStorage). */
export type ResolvedLekhaBySlug = {
  /** Canonical (current) url_slug of the lekha. */
  url_slug: string;
  /** Slug from the request URL (may be an old redirect slug). */
  requested_slug: string;
  /** True when `requested_slug` was resolved via `site_lekha_redirects`. */
  was_redirect: boolean;
};

/**
 * Resolves an old lekha slug to its canonical url_slug via the cached slug map.
 * Live url_slugs always win over redirect rules; anything else returns undefined
 * so callers fall back to the authoritative per-slug cache / 404. No DB queries.
 */
export const resolveLekhaBySlug = Effect.fn('resolveLekhaBySlug')(function* (slug: string) {
  const slug_map = yield* siteLekhaSlugMapCache.get(NO_CACHE_PARAMS);
  if (slug_map.liveSlugs.has(slug)) return undefined;
  const target = slug_map.redirectTo.get(slug);
  if (!target) return undefined;

  return {
    url_slug: target,
    requested_slug: slug,
    was_redirect: true
  } satisfies ResolvedLekhaBySlug;
});
