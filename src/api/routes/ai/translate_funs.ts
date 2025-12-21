import { generateObject } from 'ai';
import { z } from 'zod';
import { translate_route_schema, translation_out_schema } from './ai_types';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { text_models_type } from '~/state/main_app/state.svelte';

const openai_text_model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic_text_model = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = {
  'gpt-4.1': openai_text_model('gpt-4.1'),
  'claude-3.7-sonnet': anthropic_text_model('claude-3-7-sonnet-latest'),
  'o3-mini': openai_text_model('o3-mini'),
  'gpt-5.1': openai_text_model('gpt-5.1'),
  'gpt-5.2': openai_text_model('gpt-5.2')
} satisfies Record<text_models_type, any>;

const model_custom_options = {
  'o3-mini': {
    providerOptions: {
      openai: {
        reasoningEffort: 'medium'
      }
    }
  },
  'gpt-5.1': {
    providerOptions: {
      openai: {
        reasoningEffort: 'low'
      }
    }
  },
  'gpt-5.2': {
    providerOptions: {
      openai: {
        reasoningEffort: 'low'
      }
    }
  }
} satisfies {
  [key in text_models_type]?: any;
};

export const translate_func = async (payload: z.infer<typeof translate_route_schema.input>) => {
  payload = translate_route_schema.input.parse(payload);
  const { messages, model } = payload;

  try {
    const response = await generateObject({
      model: MODELS[model],
      ...(model_custom_options[model as keyof typeof model_custom_options] ?? {}),
      messages,
      output: 'array',
      schema: translation_out_schema,
      schemaDescription:
        'This should be an array of objects, each object containing the translation text and the index of the shloka to be generated.',
      schemaName: 'ai_translations_text_schema'
    });
    const translations = response.object;
    return {
      translations,
      success: true
    };
  } catch (e) {
    console.log(e);
    return { success: false };
  }
};
