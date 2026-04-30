import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

import { resolve_text_route } from '../../../../site/src/utils/text-routes';

function siteLocation(
	mainSiteUrl: string | undefined,
	pathname: string,
	search: string
): string | null {
	if (!mainSiteUrl) return null;
	const base = mainSiteUrl.replace(/\/$/, '');
	const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
	return `${base}${path}${search}`;
}

/** Mirrors Hono wildcard: resolve text routes, then redirect to canonical URL on main site. */
export const GET: RequestHandler = async ({ url }) => {
	const mainSiteUrl = env.MAIN_SITE_URL;
	if (!mainSiteUrl) error(500, 'MAIN_SITE_URL is not configured');

	const pathname = url.pathname;
	const search = url.search;

	const segments = pathname.split('/').filter(Boolean);
	const project_key = segments[0] ?? '';
	const slug_segments = segments.slice(1);

	const resolved = await resolve_text_route(project_key, slug_segments);
	const target_pathname = resolved ? (resolved.redirect_to ?? resolved.canonical_path) : pathname;

	const loc = siteLocation(mainSiteUrl, target_pathname, search);
	if (!loc) error(500, 'MAIN_SITE_URL is not configured');
	redirect(301, loc);
};
