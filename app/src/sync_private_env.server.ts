import { env } from '$env/dynamic/private';

/**
 * Mirror SvelteKit private env onto process.env (build + runtime module init).
 * Skip empty values so postbuild analyse (empty `$env/dynamic/private`) does not
 * wipe credentials already present on `process.env` (e.g. CI).
 */
for (const [key, value] of Object.entries(env)) {
  if (value) process.env[key] = value;
}
