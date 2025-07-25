import { t, protectedAdminProcedure } from '~/api/trpc_init';
import GRAMMER_PROMPT from './grammer_prompt.md?raw';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { generateText, type LanguageModelV1 } from 'ai';
import { format_string_text } from '~/tools/kry';
import { env } from '$env/dynamic/private';

const openai_text_model = createOpenAI({ apiKey: env.OPENAI_API_KEY });

const MODELS_LIST = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'] as const;

const MODELS: Record<(typeof MODELS_LIST)[number], LanguageModelV1> = {
  'gpt-4.1': openai_text_model('gpt-4.1'),
  'gpt-4.1-mini': openai_text_model('gpt-4.1-mini'),
  'gpt-4.1-nano': openai_text_model('gpt-4.1-nano')
} as const;

export const grammer_analysis_func = async (
  shloka: string,
  lang: string,
  model: keyof typeof MODELS
) => {
  const response = await generateText({
    model: MODELS[model],
    messages: [
      { role: 'system', content: format_string_text(GRAMMER_PROMPT, { lang }) },
      { role: 'user', content: `Word Meaning Language: ${lang}\n\n${shloka}` }
    ]
  });
  return response.text;
};

const grammer_analysis_route = protectedAdminProcedure
  .input(
    z.object({
      shloka: z.string(),
      lang: z.string(),
      model: z.enum(MODELS_LIST)
    })
  )
  .query(async ({ input }) => {
    const out = await grammer_analysis_func(input.shloka, input.lang, input.model);
    return out;
  });

export const grammer_router = t.router({
  grammer_analysis: grammer_analysis_route
});
