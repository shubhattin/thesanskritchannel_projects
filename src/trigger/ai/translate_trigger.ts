import { task } from '@trigger.dev/sdk/v3';
import { z } from 'zod';
import { translate_route_schema, TRANSLATE_TRIGGER_ID } from '~/api/routes/ai/ai_types';
import { translate_func } from '~/api/routes/ai/translate_funs';

export const translate = task({
  id: TRANSLATE_TRIGGER_ID,
  maxDuration: 15 * 60, // 12 minutes
  run: async (payload: z.infer<typeof translate_route_schema.input>) => {
    return await translate_func(payload);
  }
});
