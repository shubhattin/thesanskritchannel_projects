import { env } from '$env/dynamic/private';

/** Mirror SvelteKit private env onto process.env (build + runtime module init). */
Object.assign(process.env, env);
