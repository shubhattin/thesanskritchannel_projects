# Technical Details

[![App Checks](https://github.com/shubhattin/thesanskritchannel_projects/actions/workflows/checks.yml/badge.svg)](https://github.com/shubhattin/thesanskritchannel_projects/actions/workflows/checks.yml)

## Tech Stack

### **Frontend**

- **JS Framework**: [SvelteKit](https://kit.svelte.dev/) meta framework for [Svelte](https://svelte.dev/), also using [TypeScript](https://www.typescriptlang.org/)
- **Design and Components**: [TailwindCSS](https://tailwindcss.com/) along with [Skeleton UI](https://www.skeleton.dev/)
- **Query Helper** : [Tanstack Query](https://tanstack.com/query/latest) for fetching and managing asynchronous data.

### **Backend**

- **API**: [trpc](https://trpc.io/) for API
- **Database** : [PostgreSQL](https://www.postgresql.org/) hosted on [NeonDB](https://neon.tech/) and with [Drizzle](https://orm.drizzle.team/) for ORM.
- **Authentication** : Using Auth Server of [BetterAuth](https://www.better-auth.com/)
- **Hosting Provider** : [Netlify](https://www.netlify.com/) for hosting our website and API. As currently our backend is Edge Compatible so we are using Netlift Edge Functions for API.

### Shloka Image Generation

- These are the images generated for automating the processs of which would have been done manually with photoshop.
- [FabricJS](https://fabricjs.com/) is used to render the elements on the canvas. Scaling and positioning of the elements is done manually via custom formulas.
- As the native `Text` object had problems rendering indic text properly on the canvas we had to to use wasm version of [harfbuzz](https://github.com/harfbuzz/harfbuzz).
- The harfbuzzjs library was not directlt usable in the browser. So I had to modify it from the example in [https://harfbuzz.github.io/harfbuzzjs/](https://harfbuzz.github.io/harfbuzzjs/) to work with vite in browser and also nake it compatible with Web Workers API.

### AI Imaage Generation and AI Shloka Translation

- We are using [OpenAI](https://openai.com/) and [Anthropic](https://www.anthropic.com/) for the AI image generation and translation.
- **Image**
  - First we generate the image prompt using shloka text and available english translation. using `gpt-4.1`, `o4-mini` or `claude-3.7-sonnet` model.
  - Then finally we use `dall-e-3` model to generate the image.
- **Shloka Translation**
  - We use `gpt-4.1`, `o4-mini` or `claude-3.7-sonnet` model to translate the text.
  - The entire shloka text is provided along with the translation to generate English and Indian language translations.

<br/>

> ℹ️ This is a unified Interface initially made for [valmiki_ramayanam](https://github.com/shubhattin/valmiki_ramayanam), [tsc-users](https://github.com/shubhattin/tsc-users) and [bhagavadgita](https://github.com/shubhattin/bhagavadgita). Those repositories are now archived and this is the new unified interface. This will be the new base for adding more texts.
