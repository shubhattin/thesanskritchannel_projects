# Package Manager

- Use the bun package manager for all things

# Shadcn component addition

- Use command in form `bun x shadcn-svelte@latest add <component-list>` to add components.
- Both the `site` (Astro) and `app/` (Sveltekit) have their different shadcnui/svelte configurations and installed components

# General 

- Never start the dev server, as it would be already running on the provisioned port.
- The project is a monorepo with two seperate apps
- For icons you can use `svelte-icons-pack` or `@lucide/svelte`, this is same for both `site` and `app`

## /app (SvelteKit)

- This is the kind of admin portal, which was made first and has a lot of core code and functionality for handling logic.
- This is why in `site/` (Astro) it has been aliased to `$app/*` (resolves `app/src/*`) to make it easy to import and share the from the app in the site.