import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Effect } from 'effect';
import { protected_admin_route_check } from '~/api/api_init';
import {
  get_grammar_analysis_text_stream,
  get_grammar_analysis_input_schema
} from '~/api/routes/grammar/grammar';
import { runServerEffect } from '~/effect/app_runtime.server';

export const POST: RequestHandler = async ({ request }) => {
  const result = await runServerEffect(
    Effect.gen(function* () {
      const user = yield* protected_admin_route_check(request.headers);
      if (!user) return { kind: 'unauthorized' as const };

      const body = yield* Effect.promise(() => request.json());
      const { shloka, lang, model } = get_grammar_analysis_input_schema.parse(body);
      const stream = yield* get_grammar_analysis_text_stream(shloka, lang, model);
      return { kind: 'ok' as const, stream };
    })
  );

  if (result.kind === 'unauthorized') throw error(401, 'UNAUTHORIZED');

  return new Response(result.stream.textStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
