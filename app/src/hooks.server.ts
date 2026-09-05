import type { Handle } from '@sveltejs/kit';
import { runWithAppRuntime } from '~/effect/app_runtime.server';

/**
 * One Effect ManagedRuntime per Worker request. Sharing a process-wide runtime
 * lets fibers settle after the creating request finished, which Cloudflare
 * cancels — and can hang the next request.
 */
export const handle: Handle = ({ event, resolve }) => runWithAppRuntime(async () => resolve(event));
