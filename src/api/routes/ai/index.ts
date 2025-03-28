import { t } from '~/api/trpc_init';
import { get_generated_images_route } from './generate_image';
import { get_image_prompt_route } from './get_image_prompt';
import { trigger_funcs_router } from './trigger_funcs';

export const ai_router = t.router({
  get_image_prompt: get_image_prompt_route,
  get_generated_images: get_generated_images_route,
  trigger_funcs: trigger_funcs_router
});
