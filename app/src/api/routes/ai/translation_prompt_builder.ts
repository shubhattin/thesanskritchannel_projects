import { get_lang_from_id } from '~/state/lang_list';
import { format_string_text } from '~/tools/kry';
import { encode } from '@toon-format/toon';
import {
  ENGLISH_SYSTEM_PROMPT,
  OTHER_SYSTEM_PROMPT,
  SANSKRIT_SYSTEM_PROMPT,
  USER_PROMPT
} from '~/api/routes/ai/translation_prompt';

type TranslationPromptInput = {
  lang_id: number;
  text_name: string;
  text_data: {
    index: number;
    text: string;
    english_translation?: string;
  }[];
};

export function build_translation_prompts(args: TranslationPromptInput) {
  const lang = get_lang_from_id(args.lang_id);
  const system_prompt =
    lang === 'English'
      ? ENGLISH_SYSTEM_PROMPT
      : lang === 'Sanskrit'
        ? SANSKRIT_SYSTEM_PROMPT
        : OTHER_SYSTEM_PROMPT;

  const user_prompt = format_string_text(USER_PROMPT, {
    text_name: args.text_name,
    text: encode(args.text_data),
    lang
  });

  return { lang, system_prompt, user_prompt };
}
