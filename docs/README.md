# Docs

- [Isolated resources on workerd (Effect)](./workerd-effect-isolation.md) — request-scoped I/O and Effect runtimes for Cloudflare Workers (Astro, SvelteKit, TanStack Start).
- [SvelteKit on workerd: `cloudflare:*` imports](./workerd-sveltekit-cloudflare-imports.md) — why static `cloudflare:workers` imports break `vite build` (build-time route analysis runs the server bundle in Node) and the lazy-import pattern that works.
- [AWS SDK v3 S3 on workerd](./workerd-aws-sdk-s3.md) — `@aws-sdk/client-s3` inside Vite/workerd (not the R2 Node example): Node `runtimeConfig`, `getReader` vs Node streams, checksums.
