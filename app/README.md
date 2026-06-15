# Admin Portal (`app/`)

The internal admin panel for The Sanskrit Channel, built with **SvelteKit** and **Svelte 5**.

Used for managing all content that powers the public site — texts, translations, shlokas, lekha posts, and more.

## Features

### Content Management

- **Texts** — Add, edit, and organise Sanskrit/Vedic texts with rich editing
- **Translations** — Multi-language translation workflows with status tracking
- **Shloka** — Manage the verse collection with image generation
- **Lekha** — Blog/article writing and publishing workspace
- **Project Map** — Hierarchical reference map of texts and their structure (kāṇḍa, sarga, etc.)

### AI & Tools

- **AI-assisted translation** — LLM-powered translation via OpenRouter, OpenAI, and Vercel AI SDK
- **Grammar analyzer** — AI-powered sandhi breakdown, vibhakti, lakara, and word-meaning analysis
- **Image generation** — Generate shloka images and other assets
- **Image tool** — Canvas-based editor (Konva.js) for rendering Sanskrit text as shareable images
- **Script transliteration** — Lipi Parivartak for converting between 19 Indian scripts and 14 translation languages

### Infrastructure

- **Auth** — Google OAuth via Better Auth
- **Database** — Neon PostgreSQL with Drizzle ORM, Upstash Redis for caching
- **Background jobs** — Trigger.dev for async processing
- **API** — tRPC with TanStack Svelte Query

## Tech Stack

|           |                                   |
| --------- | --------------------------------- |
| Framework | SvelteKit (Svelte 5)              |
| Language  | TypeScript                        |
| UI        | shadcn-svelte, TailwindCSS v4     |
| Database  | Neon PostgreSQL + Drizzle ORM     |
| Cache     | Upstash Redis                     |
| AI        | OpenRouter, OpenAI, Vercel AI SDK |
| Auth      | Better Auth (Google OAuth)        |
| API       | tRPC                              |
| Deploy    | Netlify / Vercel                  |

## Development

```bash
bun install
bun run dev
```

Requires a `.env` file with database, auth, and AI API credentials.
