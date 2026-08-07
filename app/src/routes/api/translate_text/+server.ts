import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { Effect } from 'effect';
import { protected_admin_route_check } from '~/api/api_init';
import { translate_route_schema } from '~/api/routes/ai/ai_types';
import { translate_func } from '~/api/routes/ai/translate_funs';
import { runServerEffect } from '~/effect/app_runtime.server';

/** Per-route Vercel function config (SvelteKit adapter-vercel). `split` so this route is its own function with its own maxDuration. */
export const config: Config = {
  split: true,
  maxDuration: 600
};

export const POST: RequestHandler = async ({ request }) => {
  const result = await runServerEffect(
    Effect.gen(function* () {
      const user = yield* protected_admin_route_check(request.headers);
      if (!user) return { kind: 'unauthorized' as const };

      const input = translate_route_schema.input.parse(yield* Effect.promise(() => request.json()));
      const out = yield* translate_func(input);
      return {
        kind: 'ok' as const,
        out: translate_route_schema.output.parse(out)
      };
    })
  );

  if (result.kind === 'unauthorized') throw error(401, 'UNAUTHORIZED');
  return json(result.out);
};
