import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { get_image_prompt_route } from './get_image_prompt';
import { image_gen_route_schema } from './ai_types';
import { gen_image_func } from './image_gen_funcs';
import { image_assets_router } from './image_assets';
import { image_system_prompts_router } from './image_system_prompts';
import { runTrpcEffect } from '~/effect/app_runtime.server';

export const ai_router = t.router({
  get_image_prompt: get_image_prompt_route,
  image_assets: image_assets_router,
  system_prompts: image_system_prompts_router,
  gen_image: protectedAdminProcedure
    .input(image_gen_route_schema.input)
    .output(image_gen_route_schema.output)
    .mutation(({ input }) => runTrpcEffect(gen_image_func(input)))
});
