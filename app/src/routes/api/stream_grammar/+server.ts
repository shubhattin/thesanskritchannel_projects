import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { protected_admin_route_check } from '~/api/api_init';
import {
  get_grammar_analysis_text_stream,
  get_grammar_analysis_input_schema
} from '~/api/routes/grammar/grammar';

export const POST: RequestHandler = async ({ request }) => {
  const user = await protected_admin_route_check(request.headers);
  if (!user || user.role !== 'admin') throw error(401, 'UNAUTHORIZED');

  const { shloka, lang, model } = get_grammar_analysis_input_schema.parse(await request.json());

  const result = await get_grammar_analysis_text_stream(shloka, lang, model);

  return new Response(result.textStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
