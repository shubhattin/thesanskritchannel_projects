import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { get_image_prompt_route } from './get_image_prompt';
import { trigger_funcs_router } from './trigger_funcs';
import { z } from 'zod';
import { image_gen_route_schema, translate_route_schema } from './ai_types';
import { gen_image_func } from './image_gen_funcs';
import { translate_func } from './translate_funs';

export const ai_router = t.router({
  get_image_prompt: get_image_prompt_route,
  trigger_funcs: trigger_funcs_router,
  gen_image: protectedAdminProcedure
    .input(image_gen_route_schema.input)
    .output(
      z.discriminatedUnion('success', [
        image_gen_route_schema.output,
        z.object({
          success: z.literal(false)
        })
      ])
    )
    // @ts-ignore
    .query(async ({ input }) => {
      const out = await gen_image_func(input);

      return out;
    }),
  translate_text: protectedAdminProcedure
    .input(translate_route_schema.input)
    .output(translate_route_schema.output)
    // @ts-ignore
    .query(async ({ input }) => {
      const out = await translate_func(input);

      return out;
    })
});
