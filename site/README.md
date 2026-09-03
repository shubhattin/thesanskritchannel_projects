# Public Site (`site/`)

The public-facing website for The Sanskrit Channel, built with **SvelteKit** and **Svelte 5**.

Presents the content managed through the [admin portal](../app/) in a clean, reader-friendly format with multi-script support.

🌐 **[thesanskritchannel.org](https://thesanskritchannel.org)**

## Pages

- **Texts** — Browse and read Sanskrit/Vedic texts with translations and script switching across 15+ Indian scripts
- **Lekha** — Blog posts and articles with markdown rendering and transliteration support
- **Support** — Donation and membership options (UPI, Razorpay, PayPal, Patreon)

## Highlights

- **Multi-script reader** — client-side script switching (no reload); SSR pre-transliterates for the cookie preference
- **Dynamic translations** — language change fetches `/api/get_trans` without a full page reload
- **Pretty URLs** — `/ramayanam/kanda-1/sarga-5` with automatic redirects from numeric paths
- **Server-rendered + cached** — SSR with Redis caching for fast loads
- **Dark/light theme** with system preference detection

## Tech Stack

|               |                                                    |
| ------------- | -------------------------------------------------- |
| Framework     | SvelteKit 2 (SSR)                                  |
| UI            | Svelte 5                                           |
| Styling       | TailwindCSS v4, `@tailwindcss/typography`          |
| UI Components | shadcn-svelte                                      |
| Database      | Neon PostgreSQL + Drizzle ORM (shared with `app/`) |
| Cache         | Upstash Redis                                      |
| Fonts         | 16+ Noto Sans packages for Indian scripts          |
| Analytics     | PostHog                                            |
| Deploy        | Vercel (Mumbai region)                             |

## Code Sharing

The site imports shared code from the admin app via the `@app/*` alias (resolves to `../app/src/*`) — database schemas, server loaders, types, and utilities. (`$app/*` is reserved by SvelteKit.)

Content is created in the admin portal, stored in the shared database, and rendered read-only by this site.

## Scripts

```bash
bun run dev      # vite dev
bun run build    # production build
bun run check    # svelte-check
bun run format   # oxfmt (svelte/ts/js/css/json)
bun run lint     # oxlint
bun run test     # vitest
```
