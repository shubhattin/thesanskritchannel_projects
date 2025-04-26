import { task } from '@trigger.dev/sdk/v3';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  chapter_translate_schema,
  translation_out_schema,
  TRANSLATE_TRIGGER_ID
} from '~/api/routes/ai/ai_types';

const openai_text_model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic_text_model = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const translate_sarga = task({
  id: TRANSLATE_TRIGGER_ID,
  maxDuration: 15 * 60, // 12 minutes
  run: async (payload: z.infer<typeof chapter_translate_schema.input>) => {
    payload = chapter_translate_schema.input.parse(payload);
    const { messages, model } = payload;

    try {
      const response = await generateObject({
        model: {
          'gpt-4.1': openai_text_model('gpt-4.1'),
          'claude-3.7-sonnet': anthropic_text_model('claude-3-7-sonnet-latest'),
          'o4-mini': openai_text_model('o4-mini')
        }[model],
        ...(model === 'o4-mini'
          ? {
              providerOptions: {
                openai: {
                  reasoningEffort: 'medium'
                }
              }
            }
          : {}),
        messages,
        output: 'array',
        schema: translation_out_schema,
        schemaDescription:
          'This should be an array of objects, each object containing the translation text and the index of the shloka to be generated.',
        schemaName: 'ai_translations_text_schema'
      });
      return { translations: response.object, success: true };
    } catch (e) {
      console.log(e);
      return { success: false };
    }
  }
});
