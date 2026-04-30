/**
 * Vercel + Hono: default export must be the Hono app (not Bun.serve config).
 * @see https://vercel.com/docs/frameworks/backend/hono
 */
import { createRedirectApp } from './redirect-app'

export default createRedirectApp(process.env.MAIN_SITE_URL)
