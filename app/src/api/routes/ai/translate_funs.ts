import { generateText, Output } from 'ai';
import { z } from 'zod';
import { translate_route_schema, translation_out_schema } from './ai_types';
import { get_lang_from_id } from '~/state/lang_list';
import { format_string_text } from '~/tools/kry';
import {
  ENGLISH_SYSTEM_PROMPT,
  OTHER_SYSTEM_PROMPT,
  SANSKRIT_SYSTEM_PROMPT,
  USER_PROMPT
} from './translation_prompt';
import { OPENROUTER_TEXT_MODELS, text_model_custom_options } from './providers';

type translation_prompt_yaml_type = Record<
  'English' | 'Sanskrit' | 'Other',
  {
    system_prompt: string;
    user_msg: string;
  }
>;

const translation_prompt_langs: translation_prompt_yaml_type = {
  English: {
    system_prompt: ENGLISH_SYSTEM_PROMPT,
    user_msg: USER_PROMPT
  },
  Sanskrit: {
    system_prompt: SANSKRIT_SYSTEM_PROMPT,
    user_msg: USER_PROMPT
  },
  Other: {
    system_prompt: OTHER_SYSTEM_PROMPT,
    user_msg: USER_PROMPT
  }
};

type TranslationInput = z.infer<typeof translate_route_schema.input>;
type TranslationOutput = z.infer<typeof translate_route_schema.output>;

export const translate_func = async (args: TranslationInput): Promise<TranslationOutput> => {
  const { text_data, model, lang_id, text_name } = args;
  const lang = get_lang_from_id(lang_id);

  const translation_prompt =
    lang === 'English'
      ? translation_prompt_langs.English
      : lang === 'Sanskrit'
        ? translation_prompt_langs.Sanskrit
        : translation_prompt_langs.Other;

  const prompt = format_string_text(translation_prompt.user_msg, {
    text_name,
    text: JSON.stringify(text_data),
    lang
  });

  try {
    const response = await generateText({
      model: OPENROUTER_TEXT_MODELS[model],
      system: translation_prompt.system_prompt,
      ...(text_model_custom_options[model as keyof typeof text_model_custom_options] ?? {}),
      prompt,
      output: Output.array({
        element: translation_out_schema,
        description:
          'This should be an array of objects, each object containing the translation text and the index of the shloka to be generated.',
        name: 'translations_text_schema'
      })
    });
    const translations = response.output;
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
