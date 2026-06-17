import { t } from '~/api/trpc_init';
import { image_tool_preset_router } from './image_tool_preset';

export const image_tool_router = t.router({
  preset: image_tool_preset_router
});
