import { createDb, createRedis, type RuntimeEnv } from '@tsc/server-data/runtime';

// `import.meta.env` is resolved at build time by Vite.
// On Vercel, runtime secrets are available in `process.env`,
// so we merge both to support local dev + prod serverless.
const env = { ...process.env, ...import.meta.env } as RuntimeEnv;

export const db = await createDb(env, {
  isDev: import.meta.env.DEV
});

export const redis = createRedis(env);
