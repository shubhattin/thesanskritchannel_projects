import { t } from '~/api/trpc_init';
import { get_image_prompt_route } from './get_image_prompt';
import { trigger_funcs_router } from './trigger_funcs';

export const ai_router = t.router({
  get_image_prompt: get_image_prompt_route,
  trigger_funcs: trigger_funcs_router
});
