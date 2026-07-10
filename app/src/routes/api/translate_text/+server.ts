import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { protected_admin_route_check } from '~/api/api_init';
import { translate_route_schema } from '~/api/routes/ai/ai_types';
import { translate_func } from '~/api/routes/ai/translate_funs';

/** Per-route Vercel function config (SvelteKit adapter-vercel). `split` so this route is its own function with its own maxDuration. */
export const config: Config = {
  split: true,
  maxDuration: 600
};

export const POST: RequestHandler = async ({ request }) => {
  const user = await protected_admin_route_check(request.headers);
  if (!user || user.role !== 'admin') throw error(401, 'UNAUTHORIZED');

  const input = translate_route_schema.input.parse(await request.json());
  const out = await translate_func(input);

  return json(translate_route_schema.output.parse(out));
};
