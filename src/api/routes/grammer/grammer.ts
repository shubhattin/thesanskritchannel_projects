import { t, protectedAdminProcedure } from '~/api/trpc_init';
import GRAMMER_PROMPT from './grammer_prompt.md?raw';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { generateText } from 'ai';
import { format_string_text } from '~/tools/kry';
import { env } from '$env/dynamic/private';

const openai_text_model = createOpenAI({ apiKey: env.OPENAI_API_KEY });

export const grammer_analysis_func = async (shloka: string, lang: string) => {
  const response = await generateText({
    model: openai_text_model('gpt-4.1'),
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
      lang: z.string()
    })
  )
  .query(async ({ input }) => {
    const out = await grammer_analysis_func(input.shloka, input.lang);
    return out;
  });

export const grammer_router = t.router({
  grammer_analysis: grammer_analysis_route
});
