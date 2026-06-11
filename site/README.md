# Public Site (`site/`)

Astro site at [projects.thesanskritchannel.org](https://projects.thesanskritchannel.org/) — the reader-facing front door for Sanskrit texts and related resources.

## Features

### Sacred texts
- Browse listed projects (Ramayanam, Bhagavad Gita, and more)
- Navigate the project map in a clean, distraction-free layout
- Read shlokas with **translation** and **script switching** (Devanagari, Telugu, Tamil, Bengali, and others)
- Preferences for language and script are remembered across visits

### Lekha
- Published **Lekha** posts — short notes and articles from the team
- Individual post pages with rendered markdown (shloka blocks, code, etc.)

### Learning tools
Curated links to companion apps on the homepage:
- **Padavali** — Sanskrit word game
- **Svara Darshini** — Vedic pitch visualization
- **Akshara** — Indian script lessons
- **Lipi Lekhika** — script transliteration

### Other
- **Support** page
- Server-rendered routes with Redis-backed caching for fast loads

## Stack

Astro 6 · Svelte islands · Drizzle ORM · lipilekhika · Tailwind CSS

## Development

```bash
bun --cwd site dev      # http://localhost:4321
bun --cwd site check    # astro check
bun --cwd site build    # production build
```

Content is managed in the [admin portal](../app/README.md); this app reads published data from the shared database.
