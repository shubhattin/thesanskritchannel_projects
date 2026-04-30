import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

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

/** Mirrors Hono `/`: preserve query string, permanent redirect to main site root. */
export const GET: RequestHandler = ({ url }) => {
	const mainSiteUrl = env.MAIN_SITE_URL;
	if (!mainSiteUrl) error(500, 'MAIN_SITE_URL is not configured');
	const loc = siteLocation(mainSiteUrl, '/', url.search);
	if (!loc) error(500, 'MAIN_SITE_URL is not configured');
	redirect(301, loc);
};
