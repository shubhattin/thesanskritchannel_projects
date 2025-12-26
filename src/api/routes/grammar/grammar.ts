import { t, protectedAdminProcedure } from '~/api/trpc_init';
import grammar_PROMPT from './grammar_prompt.md?raw';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { generateText, streamText, type ModelMessage } from 'ai';
import { format_string_text } from '~/tools/kry';
import { env } from '$env/dynamic/private';

const openrouter_text_model = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

const MODELS_LIST = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gemini-2.0-flash',
  'gemini-2.5-flash'
] as const;

const MODELS = {
  'gpt-4.1': openrouter_text_model('openai/gpt-4.1'),
  'gpt-4.1-mini': openrouter_text_model('openai/gpt-4.1-mini'),
  'gpt-4.1-nano': openrouter_text_model('openai/gpt-4.1-nano'),
  'gpt-5': openrouter_text_model('openai/gpt-5'),
  'gpt-5-mini': openrouter_text_model('openai/gpt-5-mini'),
  'gpt-5-nano': openrouter_text_model('openai/gpt-5-nano'),
  'gemini-2.0-flash': openrouter_text_model('google/gemini-2.0-flash-001'),
  'gemini-2.5-flash': openrouter_text_model('google/gemini-2.5-flash')
} as const;

export const get_grammar_analysis_input_schema = z.object({
  shloka: z.string(),
  lang: z.string(),
  model: z.enum(MODELS_LIST)
});

const get_messages = (shloka: string, lang: string) => {
  return [
    { role: 'system', content: format_string_text(grammar_PROMPT, { lang }) },
    { role: 'user', content: `Word Meaning Language: ${lang}\n\n${shloka}` }
  ] satisfies ModelMessage[];
};

const get_grammar_analysis_text = async (
  shloka: string,
  lang: string,
  model: keyof typeof MODELS
) => {
  const response = await generateText({
    model: MODELS[model],
    messages: get_messages(shloka, lang),
    ...(model.startsWith('gpt-5')
      ? {
          providerOptions: {
            openai: {
              reasoningEffort: 'low'
            }
          }
        }
      : {})
  });
  return response.text;
};

export const get_grammar_analysis_text_stream = async (
  shloka: string,
  lang: string,
  model: keyof typeof MODELS
) => {
  const response = await streamText({
    model: MODELS[model],
    messages: get_messages(shloka, lang),
    ...(model.startsWith('gpt-5')
      ? {
          providerOptions: {
            openai: {
              reasoningEffort: 'low'
            }
          }
        }
      : {})
  });
  return response;
};

const grammar_analysis_route = protectedAdminProcedure
  .input(get_grammar_analysis_input_schema)
  .query(async ({ input }) => {
    const time = new Date();
    const out = await get_grammar_analysis_text(input.shloka, input.lang, input.model);
    return {
      text: out,
      time_ms: new Date().getTime() - time.getTime()
    };
  });

export const grammar_router = t.router({
  grammar_analysis: grammar_analysis_route
});
