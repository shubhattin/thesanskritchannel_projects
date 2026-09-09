# Docs

- [Isolated resources on workerd (Effect)](./workerd-effect-isolation.md) — request-scoped I/O and Effect runtimes for Cloudflare Workers (Astro, SvelteKit, TanStack Start).
- [SvelteKit on workerd: `cloudflare:*` imports](./workerd-sveltekit-cloudflare-imports.md) — why static `cloudflare:workers` imports break `vite build`, and the `CfEnv` / `event.platform` Effect pattern used in this repo.
- [AWS SDK v3 S3 on workerd](./workerd-aws-sdk-s3.md) — `@aws-sdk/client-s3` inside Vite/workerd (not the R2 Node example): Node `runtimeConfig`, `getReader` vs Node streams, checksums.
