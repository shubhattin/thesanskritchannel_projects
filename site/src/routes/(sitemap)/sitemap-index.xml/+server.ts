import type { RequestHandler } from './$types';
import { getSitemapIndexXml, sitemapXmlResponse } from '@app/effect/sitemap_cache';
import { runRouteEffect } from '~/effect/site_runtime';

export const GET: RequestHandler = () =>
  runRouteEffect(getSitemapIndexXml(), {
    onSuccess: sitemapXmlResponse
  });
