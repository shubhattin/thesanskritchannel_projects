import { task } from '@trigger.dev/sdk/v3';
import { z } from 'zod';
import { image_gen_route_schema, IMAGE_GENERATE_TRIGGER_ID } from '~/api/routes/ai/ai_types';
import { gen_image_func } from '~/api/routes/ai/image_gen_funcs';

export const translate_sarga = task({
  id: IMAGE_GENERATE_TRIGGER_ID,
  maxDuration: 5 * 60, // 5 minutes
  run: async (payload: z.infer<typeof image_gen_route_schema.input>) => {
    payload = image_gen_route_schema.input.parse(payload);
    return await gen_image_func(payload);
  }
});
