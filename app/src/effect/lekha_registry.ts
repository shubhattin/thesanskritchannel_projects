import { Effect } from 'effect';
import { dbRunHttp } from './database';
import { CacheError } from './errors';

/** Same env as project_registry — site-safe (no AiProvider / ObjectStorage). */
export type ResolvedLekhaBySlug = {
  lekha_id: number;
  /** Canonical (current) url_slug of the lekha. */
  url_slug: string;
  /** Slug from the request URL (may be an old redirect slug). */
  requested_slug: string;
  /** True when `requested_slug` was resolved via `site_lekha_redirects`. */
  was_redirect: boolean;
};

const toCacheError = (operation: string) => (cause: unknown) =>
  cause instanceof CacheError ? cause : CacheError.make({ operation, key: undefined, cause });

/**
 * Resolves a URL slug to a lekha. Active url_slugs always win over redirect rules.
 * Falls back to `site_lekha_redirects` when the slug is not a live lekha slug.
 */
export const resolveLekhaBySlug = Effect.fn('resolveLekhaBySlug')(function* (slug: string) {
  const direct = yield* dbRunHttp('resolveLekhaBySlug.direct', (db) =>
    db.query.site_lekhas.findFirst({
      where: (tbl, { eq: eqSlug }) => eqSlug(tbl.url_slug, slug),
      columns: { id: true, url_slug: true }
    })
  ).pipe(Effect.mapError(toCacheError('resolveLekhaBySlug.direct')));

  if (direct) {
    return {
      lekha_id: direct.id,
      url_slug: direct.url_slug,
      requested_slug: slug,
      was_redirect: false
    } satisfies ResolvedLekhaBySlug;
  }

  const redirect = yield* dbRunHttp('resolveLekhaBySlug.redirect', (db) =>
    db.query.site_lekha_redirects.findFirst({
      where: (tbl, { eq: eqSlug }) => eqSlug(tbl.url_slug, slug),
      columns: { lekha_id: true }
    })
  ).pipe(Effect.mapError(toCacheError('resolveLekhaBySlug.redirect')));

  if (!redirect) return undefined;

  const target = yield* dbRunHttp('resolveLekhaBySlug.target', (db) =>
    db.query.site_lekhas.findFirst({
      where: (tbl, { eq: eqId }) => eqId(tbl.id, redirect.lekha_id),
      columns: { id: true, url_slug: true }
    })
  ).pipe(Effect.mapError(toCacheError('resolveLekhaBySlug.target')));

  if (!target) return undefined;

  return {
    lekha_id: target.id,
    url_slug: target.url_slug,
    requested_slug: slug,
    was_redirect: true
  } satisfies ResolvedLekhaBySlug;
});
