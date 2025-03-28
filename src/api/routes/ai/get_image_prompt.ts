import { protectedAdminProcedure } from '~/api/trpc_init';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from '$env/dynamic/private';
import { text_models_enum } from './ai_types';

const openai_text_model = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const anthropic_text_model = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

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
      const result = await generateObject({
        model: {
          'gpt-4o': openai_text_model('gpt-4o'),
          'claude-3.7-sonnet': anthropic_text_model('claude-3-7-sonnet-latest'),
          'o3-mini': openai_text_model('o3-mini')
        }[model],
        messages,
        schema: z.object({
          image_prompt: z.string()
        })
      });
      return { ...result.object, time_taken: Date.now() - time_start };
    } catch (e) {
      return { image_prompt: null };
    }
  });
