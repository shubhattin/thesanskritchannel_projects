import { generateObject } from 'ai';
import { z } from 'zod';
import {
  translate_route_schema,
  translation_out_schema,
  type ai_text_models_type
} from './ai_types';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { get_lang_from_id } from '~/state/lang_list';
import translation_prompt_yaml_obj from './translation_prompt.yaml';
import { format_string_text } from '~/tools/kry';
import { encode } from '@toon-format/toon';

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

type translation_prompt_yaml_type = Record<
  'English' | 'Other',
  {
    system_prompt: string;
    user_msg: string;
  }
>;

const translation_prompt_langs: translation_prompt_yaml_type = {
  English: {
    system_prompt: translation_prompt_yaml_obj.system_prompt,
    user_msg: translation_prompt_yaml_obj.user_msg
  },
  Other: {
    system_prompt: translation_prompt_yaml_obj.system_prompt,
    user_msg: translation_prompt_yaml_obj.user_msg
  }
};

type TranslationInput = z.infer<typeof translate_route_schema.input>;
type TranslationOutput = z.infer<typeof translate_route_schema.output>;

export const translate_func = async (args: TranslationInput): Promise<TranslationOutput> => {
  const { text_data, model, lang_id, text_name } = args;
  const lang = get_lang_from_id(lang_id);

  const translation_prompt =
    lang === 'English' ? translation_prompt_langs.English : translation_prompt_langs.Other;

  const prompt = format_string_text(translation_prompt.user_msg, {
    text_name,
    text: encode(text_data),
    lang
  });

  try {
    const response = await generateObject({
      model: MODELS[model],
      system: translation_prompt.system_prompt,
      ...(model_custom_options[model as keyof typeof model_custom_options] ?? {}),
      prompt,
      output: 'array',
      schema: translation_out_schema,
      schemaDescription:
        'This should be an array of objects, each object containing the translation text and the index of the shloka to be generated.',
      schemaName: 'translations_text_schema'
    });
    const translations = response.object;
    if (
      translations.length !== text_data.length ||
      translations.some((translation, i) => translation.index !== i)
    ) {
      console.error('Translation Rejected: Length mismatch or order mismatch');
      return { success: false, error: 'Translation Rejected: Length mismatch or order mismatch' };
    }
    return {
      translations,
      success: true
    };
  } catch (e) {
    console.log(e);
    return { success: false, error: 'Translation Failed: ' };
  }
};
