This is used to redirect old `projects` subdomain to main root domain.
It also works for corresponding text parts.

## Run locally (matches Vercel)

From `redirect/`, with env set (e.g. `MAIN_SITE_URL`):

- **`bun install`** — uses [`bun.lock`](bun.lock) (keep this file committed).
- **`bun run dev`** — [Vercel CLI `vercel dev`](https://vercel.com/docs/cli/dev), same wiring as production per [Hono on Vercel](https://vercel.com/docs/frameworks/backend/hono).

Vercel’s install step uses **`npm install`** (see `vercel.json#installCommand`) so the Vercel CLI does not spawn **`bun`** during CI/build, while **`bun.lock`** stays in the repo for Bun installs.

## Entry

- **`src/index.ts`** — default-exported `Hono` app for Vercel (`export default app`).
