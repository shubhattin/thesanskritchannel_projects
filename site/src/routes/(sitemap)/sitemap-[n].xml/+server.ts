import type { RequestHandler } from './$types';
import { Effect } from 'effect';
import { NotFoundError } from '@app/effect/errors';
import { getSitemapXml, parseSitemapNumber, sitemapXmlResponse } from '@app/effect/sitemap_cache';
import { runRouteEffect } from '~/effect/site_runtime';

export const GET: RequestHandler = ({ params }) =>
  runRouteEffect(
    Effect.gen(function* () {
      const n = parseSitemapNumber(params.n);
      if (n === null) {
        return yield* Effect.fail(
          NotFoundError.make({ resource: 'sitemap', message: `Sitemap not found: ${params.n}` })
        );
      }
      return yield* getSitemapXml(n);
    }),
    {
      onSuccess: sitemapXmlResponse
    }
  );
