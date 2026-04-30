import { createRedirectApp } from './redirect-app'

const app = createRedirectApp(process.env.MAIN_SITE_URL)

const port = Number(process.env.PORT) || 5273

export default {
  port,
  fetch: app.fetch,
}
