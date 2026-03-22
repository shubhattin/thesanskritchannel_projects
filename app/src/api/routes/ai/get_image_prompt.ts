import { protectedAdminProcedure } from '~/api/trpc_init';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { text_models_enum } from './ai_types';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter_text_model = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

const MODELS = {
  'gpt-4.1': openrouter_text_model('openai/gpt-4.1'),
  'o3-mini': openrouter_text_model('openai/o3-mini'),
  'gpt-5.1': openrouter_text_model('openai/gpt-5.1'),
  'gpt-5.2': openrouter_text_model('openai/gpt-5.2')
} as const;

export const get_image_prompt_route = protectedAdminProcedure
  .input(
    z.object({
      messages: z
        .object({
          role: z.union([z.literal('user'), z.literal('assistant')]),
          content: z.string()
        })
        .array(),
      model: text_models_enum
    })
  )
  .query(async ({ input: { messages, model } }) => {
    try {
      const time_start = Date.now();
      const result = await generateText({
        model: MODELS[model],
        messages,
        output: Output.object({
          schema: z.object({
            image_prompt: z.string()
          })
        })
      });
      return { ...result.output, time_taken: Date.now() - time_start };
    } catch (e) {
      return { image_prompt: null };
    }
  });
