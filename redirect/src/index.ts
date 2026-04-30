import { createRedirectApp } from './redirect-app'

/**
 * Vercel runs this as a Hono app (default export).
 * @see https://vercel.com/docs/frameworks/backend/hono
 */
const app = createRedirectApp(process.env.MAIN_SITE_URL)

export default app
