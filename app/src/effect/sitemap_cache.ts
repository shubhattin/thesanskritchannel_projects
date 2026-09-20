import { Effect } from 'effect';
import ms from 'ms';
import { z } from 'zod';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import type { recursive_list_type } from '~/state/data_types';
import { is_empty_list_branch, list_item_path_value } from '~/state/project_list';
import { build_project_path } from '~/utils/project_site_paths';
import { createCache, NO_CACHE_PARAMS, type NoCacheParams } from './cache';
import { dbRunHttp } from './database';
import { CacheError, NotFoundError } from './errors';

/** Public origin written into sitemap `<loc>` and robots.txt. */
export const PUBLIC_SITE_ORIGIN = 'https://thesanskritchannel.org';

/** Hard cap of URLs per dynamic sitemap (`sitemap-1.xml` onward). */
export const SITEMAP_URL_LIMIT = 1000;

const SITEMAP_TTL_SECONDS = ms('3 days') / 1000;

export const sitemapCacheKey = REDIS_CACHE_KEYS_CLIENT.sitemap();

/** Direct public pages from `site/src/routes` — always `sitemap-0.xml`. */
export const STATIC_SITEMAP_PATHS = ['/', '/texts', '/lekha', '/support'] as const;

export type SitemapUrlEntry = {
  loc: string;
  lastmod?: Date;
};

export type SitemapCacheValue = {
  sitemaps: string[];
};

const sitemapCacheSchema = z.object({
  sitemaps: z.string().array()
});

const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600'
} as const;

const toCacheError = (operation: string) => (cause: unknown) =>
  cause instanceof CacheError ? cause : CacheError.make({ operation, key: sitemapCacheKey, cause });

const normalizeOrigin = (url: string): string => url.replace(/\/+$/, '');

export const joinSitemapUrl = (base: string, pathname: string): string =>
  `${normalizeOrigin(base)}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;

export const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const formatLastmod = (date: Date): string => date.toISOString();

export const buildUrlsetXml = (entries: SitemapUrlEntry[]): string => {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${formatLastmod(entry.lastmod)}</lastmod>` : '';
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
};

export const buildSitemapIndexXml = (
  dynamicCount: number,
  origin: string = PUBLIC_SITE_ORIGIN
): string => {
  const locs = [
    'sitemap-0.xml',
    ...Array.from({ length: dynamicCount }, (_, i) => `sitemap-${i + 1}.xml`)
  ];
  const body = locs
    .map((name) => `<sitemap><loc>${escapeXml(joinSitemapUrl(origin, `/${name}`))}</loc></sitemap>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
};

export const chunkSitemapEntries = (
  entries: SitemapUrlEntry[],
  size: number = SITEMAP_URL_LIMIT
): SitemapUrlEntry[][] => {
  if (entries.length === 0 || size < 1) return [];
  const chunks: SitemapUrlEntry[][] = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size));
  }
  return chunks;
};

/**
 * Walk a listed project's map into canonical public paths.
 * Skips childless list nodes (empty `list`, no descendants to index).
 */
export const collect_project_sitemap_paths = (
  project_key: string,
  map: recursive_list_type
): string[] => {
  const paths: string[] = [];

  const walk = (node: recursive_list_type, path_params: number[]) => {
    if (is_empty_list_branch(node)) return;

    const path = build_project_path(project_key, map, path_params);
    if (path) paths.push(path);

    if (node.info.type !== 'list') return;
    const children = node.list ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      walk(child, [...path_params, list_item_path_value(i)]);
    }
  };

  walk(map, []);
  return paths;
};

export const buildStaticSitemapXml = (origin: string = PUBLIC_SITE_ORIGIN): string =>
  buildUrlsetXml(
    STATIC_SITEMAP_PATHS.map((pathname) => ({ loc: joinSitemapUrl(origin, pathname) }))
  );

export const parseSitemapNumber = (raw: string): number | null => {
  if (!/^(0|[1-9]\d*)$/.test(raw)) return null;
  return Number(raw);
};

export const sitemapXmlResponse = (xml: string): Response =>
  new Response(xml, { headers: XML_HEADERS });

const resolveLekhaLastmod = (row: {
  updated_at: Date | null;
  published_at: Date | null;
  created_at: Date;
}): Date => row.updated_at ?? row.published_at ?? row.created_at;

export const sitemapCache = createCache<NoCacheParams, SitemapCacheValue>({
  getKey: () => sitemapCacheKey,
  schema: sitemapCacheSchema,
  ttlSeconds: SITEMAP_TTL_SECONDS,
  useSingleFlight: true,
  fetch: Effect.fn('sitemap.fetch')(function* (_params) {
    const [listed, lekhas] = yield* Effect.all([
      dbRunHttp('sitemap.projects', (db) =>
        db.query.projects.findMany({
          columns: { key: true, map: true },
          where: (tbl, { eq: eqCol }) => eqCol(tbl.listed, true),
          orderBy: ({ id }, { asc }) => asc(id)
        })
      ).pipe(Effect.mapError(toCacheError('sitemap.projects'))),
      dbRunHttp('sitemap.lekhas', (db) =>
        db.query.site_lekhas.findMany({
          columns: {
            url_slug: true,
            updated_at: true,
            published_at: true,
            created_at: true
          },
          where: (tbl, { and: andOp, eq: eqCol }) =>
            andOp(
              eqCol(tbl.draft, false),
              eqCol(tbl.listed, true),
              eqCol(tbl.search_indexed, true)
            ),
          orderBy: ({ published_at }, { desc }) => desc(published_at)
        })
      ).pipe(Effect.mapError(toCacheError('sitemap.lekhas')))
    ]);

    const entries: SitemapUrlEntry[] = [
      ...listed.flatMap((project) =>
        collect_project_sitemap_paths(project.key, project.map).map((pathname) => ({
          loc: joinSitemapUrl(PUBLIC_SITE_ORIGIN, pathname)
        }))
      ),
      ...lekhas.map((lekha) => ({
        loc: joinSitemapUrl(PUBLIC_SITE_ORIGIN, `/lekha/${encodeURIComponent(lekha.url_slug)}`),
        lastmod: resolveLekhaLastmod(lekha)
      }))
    ];

    return {
      sitemaps: chunkSitemapEntries(entries).map((chunk) => buildUrlsetXml(chunk))
    };
  })
});

export const getSitemapIndexXml = Effect.fn('getSitemapIndexXml')(function* () {
  const { sitemaps } = yield* sitemapCache.get(NO_CACHE_PARAMS);
  return buildSitemapIndexXml(sitemaps.length);
});

export const getSitemapXml = Effect.fn('getSitemapXml')(function* (n: number) {
  if (n === 0) return buildStaticSitemapXml();

  const { sitemaps } = yield* sitemapCache.get(NO_CACHE_PARAMS);
  const xml = sitemaps[n - 1];
  if (xml === undefined) {
    return yield* Effect.fail(
      NotFoundError.make({ resource: 'sitemap', message: `Sitemap not found: ${n}` })
    );
  }
  return xml;
});
