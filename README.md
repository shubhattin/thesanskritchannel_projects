# The Sanskrit Channel Projects

<div align="center">

[![App Checks](https://github.com/shubhattin/thesanskritchannel_projects/actions/workflows/checks.yml/badge.svg)](https://github.com/shubhattin/thesanskritchannel_projects/actions/workflows/checks.yml)

_A platform for digitizing, managing, and sharing Sanskrit texts_

**[🌐 Public Site](https://projects.thesanskritchannel.org/)**

</div>

---

## Repository layout

| Path | Role |
| --- | --- |
| [`./site/`](./site/) | Public-facing **Astro** site — browse texts, read Lekha posts, discover learning tools |
| [`./app/`](./app/) | Authenticated **SvelteKit** admin portal — manage content, translations, and project structure |
| [`./redirect/`](./redirect/) | Lightweight redirect service for legacy URLs |
| [`./data/`](./data/) | Source text data and extraction scripts |

The root package is a **Bun workspace**. Run checks across both apps with `bun run check`.

## What we host

Classical Sanskrit texts such as Valmiki Ramayanam, Bhagavad Gita, Narayaneeyam, Shiva Tandava Stotra, and Saundarya Lahari — with translations and multi-script reading on the public site.

## At a glance

**Public site** (`site/`) — clean reading experience, script switching, Lekha articles, and links to companion learning apps.

**Admin portal** (`app/`) — project & text editing, translation workflow, project map management, Lekha publishing, plus AI-assisted translation, AI image generation, and a shloka image tool.

See each package README for details:

- [Admin portal →](./app/README.md)
- [Public site →](./site/README.md)

## Development

```bash
bun install

# Admin portal (SvelteKit)
bun --cwd app dev

# Public site (Astro)
bun --cwd site dev
```
