import { Hono } from 'hono'
import { resolve_text_route } from '../../site/src/utils/text-routes'

export function siteLocation(
  mainSiteUrl: string | undefined,
  pathname: string,
  search: string
): string | null {
  if (!mainSiteUrl) return null
  const base = mainSiteUrl.replace(/\/$/, '')
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${base}${path}${search}`
}

export function createRedirectApp(mainSiteUrl: string | undefined) {
  const app = new Hono()

  app.get('/', (c) => {
    const search = new URL(c.req.url).search
    const loc = siteLocation(mainSiteUrl, '/', search)
    if (!loc) return c.text('MAIN_SITE_URL is not configured', 500)
    return c.redirect(loc, 301)
  })

  app.get('*', async (c) => {
    if (!mainSiteUrl) return c.text('MAIN_SITE_URL is not configured', 500)

    const url = new URL(c.req.url)
    const pathname = url.pathname
    const search = url.search

    const segments = pathname.split('/').filter(Boolean)
    const project_key = segments[0] ?? ''
    const slug_segments = segments.slice(1)

    const resolved = await resolve_text_route(project_key, slug_segments)
    const target_pathname = resolved
      ? resolved.redirect_to ?? resolved.canonical_path
      : pathname

    const loc = siteLocation(mainSiteUrl, target_pathname, search)
    if (!loc) return c.text('MAIN_SITE_URL is not configured', 500)
    return c.redirect(loc, 301)
  })

  return app
}
