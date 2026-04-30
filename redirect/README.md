This is used to redirect old `projects` subdomain to main root domain.
It also works for corresponding text parts.

## Run locally (matches Vercel)

From `redirect/`, with env set (e.g. `MAIN_SITE_URL`):

- **`bun run dev`** — [Vercel CLI `vercel dev`](https://vercel.com/docs/cli/dev), same runtime wiring as production per [Hono on Vercel](https://vercel.com/docs/frameworks/backend/hono).

## Entry

- **`src/index.ts`** — default-exported `Hono` app for Vercel (`export default app`).