# Admin Portal (`app/`)

SvelteKit application for managing all content published on [The Sanskrit Channel](https://projects.thesanskritchannel.org/). Requires authentication; access is scoped by role (admin or collaborator).

## Core features

### Projects & texts
- Browse and edit Sanskrit texts organized by **project map** (chapters, sections, shlokas)
- Edit source text and translations across multiple languages
- **Bulk edit** translations; import/export via Excel
- Multimedia links per text node
- Project settings — listing, slugs, metadata

### Project map
- Visual tree editor for restructuring how a text is organized
- Rename list nodes and Devanagari titles inline

### Lekha
- Create and manage **Lekha** posts (notes and articles)
- Rich markdown editor with custom Carta extensions (shloka blocks, Lipi input)
- Draft / published workflow; control visibility and search indexing on the public site

### Search & grammar
- Full-text **search** across projects
- **Grammar analysis** — AI-powered shloka breakdown (padapatha, anvaya, etc.)

## Advanced tools

- **AI-assisted translation** — generate and refine translations with language models
- **AI image generation** — create visuals from shloka content
- **Image tool** — design and export formatted shloka images (fonts, colors, layout)
- **Lipi transliteration** — convert between Indian scripts while editing
- Typing assistance for Sanskrit input
- Cache invalidation and text download utilities

## Stack

SvelteKit 5 · tRPC · Drizzle ORM · better-auth · Trigger.dev (background AI jobs) · lipilekhika

## Development

```bash
bun --cwd app dev      # http://localhost:5173
bun --cwd app check    # type-check
bun --cwd app test     # vitest
```
