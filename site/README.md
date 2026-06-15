# Public Site (`site/`)

The public-facing website for The Sanskrit Channel, built with **Astro** and **Svelte 5** islands.

Presents the content managed through the [admin portal](../app/) in a clean, reader-friendly format with multi-script support.

🌐 **[thesanskritchannel.org](https://thesanskritchannel.org)**

## Pages

- **Texts** — Browse and read Sanskrit/Vedic texts with translations and script switching across 15+ Indian scripts
- **Lekha** — Blog posts and articles with markdown rendering and transliteration support
- **Support** — Donation and membership options (UPI, Razorpay, PayPal, Patreon)

## Highlights

- **Multi-script reader** — switch between Devanagari, Telugu, Tamil, Bengali, Kannada, and more; preferences saved per user
- **Pretty URLs** — `/ramayanam/kanda-1/sarga-5` with automatic redirects from numeric paths
- **Server-rendered + cached** — SSR with Redis caching for fast loads
- **Dark/light theme** with system preference detection
- **View transitions** via Astro ClientRouter

## Tech Stack

|               |                                                    |
| ------------- | -------------------------------------------------- |
| Framework     | Astro 5, SSR mode                                  |
| UI Islands    | Svelte 5 (`@astrojs/svelte`)                       |
| Styling       | TailwindCSS v4, `@tailwindcss/typography`          |
| UI Components | shadcn-svelte                                      |
| Database      | Neon PostgreSQL + Drizzle ORM (shared with `app/`) |
| Cache         | Upstash Redis                                      |
| Fonts         | 16+ Noto Sans packages for Indian scripts          |
| Analytics     | PostHog                                            |
| Deploy        | Vercel (Mumbai region)                             |

## Code Sharing

The site imports shared code from the admin app via the `$app/*` alias (resolves to `../app/src/*`) — database schemas, server loaders, types, and utilities. Content is created in the admin portal, stored in the shared database, and rendered read-only by this site.

## Development

```bash
bun install
bun run dev
```

Runs on `localhost:4321` by default. Requires the same `.env` credentials as the admin app.
