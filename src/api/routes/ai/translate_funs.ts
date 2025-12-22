import { generateObject } from 'ai';
import { z } from 'zod';
import {
  translate_route_schema,
  translation_out_schema,
  type ai_text_models_type
} from './ai_types';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// import { createOpenAI } from '@ai-sdk/openai';
// const openai_text_model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openrouter_text_model = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const MODELS = {
  'gpt-4.1': openrouter_text_model('openai/gpt-4.1'),
  'o3-mini': openrouter_text_model('openai/o3-mini'),
  'gpt-5.1': openrouter_text_model('openai/gpt-5.1'),
  'gpt-5.2': openrouter_text_model('openai/gpt-5.2')
} satisfies Record<ai_text_models_type, any>;

const model_custom_options = {
  'o3-mini': {
    providerOptions: {
      openrouter: {
        reasoningEffort: 'medium'
      }
    }
  },
  'gpt-5.1': {
    providerOptions: {
      openrouter: {
        reasoningEffort: 'low'
      }
    }
  },
  'gpt-5.2': {
    providerOptions: {
      openrouter: {
        reasoningEffort: 'low'
      }
    }
  }
} satisfies {
  [key in ai_text_models_type]?: any;
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
