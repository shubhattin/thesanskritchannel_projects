import { Effect } from 'effect';
import { t, protectedAdminProcedure } from '~/api/trpc_init';
import grammar_PROMPT from './grammar_prompt.md?raw';
import { z } from 'zod';
import { generateText, streamText, type ModelMessage } from 'ai';
import { format_string_text } from '~/tools/kry';
import { AiProvider } from '~/effect/ai';
import { runTrpcEffect } from '~/effect/app_runtime.server';

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

const MODEL_IDS = {
  'gpt-4.1': 'openai/gpt-4.1',
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'gpt-4.1-nano': 'openai/gpt-4.1-nano',
  'gpt-5': 'openai/gpt-5',
  'gpt-5-mini': 'openai/gpt-5-mini',
  'gpt-5-nano': 'openai/gpt-5-nano',
  'gemini-2.0-flash': 'google/gemini-2.0-flash-001',
  'gemini-2.5-flash': 'google/gemini-2.5-flash'
} as const satisfies Record<(typeof MODELS_LIST)[number], string>;

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

const resolveGrammarModel = (model: keyof typeof MODEL_IDS) =>
  Effect.gen(function* () {
    const ai = yield* AiProvider;
    return ai.openrouterModel(MODEL_IDS[model]);
  });

const gpt5Options = (model: keyof typeof MODEL_IDS) =>
  model.startsWith('gpt-5')
    ? {
        providerOptions: {
          openai: {
            reasoningEffort: 'low' as const
          }
        }
      }
    : {};

const get_grammar_analysis_text = (shloka: string, lang: string, model: keyof typeof MODEL_IDS) =>
  Effect.gen(function* () {
    const languageModel = yield* resolveGrammarModel(model);
    return yield* Effect.promise(async () => {
      const response = await generateText({
        model: languageModel,
        messages: get_messages(shloka, lang),
        ...gpt5Options(model)
      });
      return response.text;
    });
  });

/** Domain Effect — run only at a HTTP/tRPC boundary. */
export const get_grammar_analysis_text_stream = (
  shloka: string,
  lang: string,
  model: keyof typeof MODEL_IDS
) =>
  Effect.gen(function* () {
    const languageModel = yield* resolveGrammarModel(model);
    return yield* Effect.promise(() =>
      Promise.resolve(
        streamText({
          model: languageModel,
          messages: get_messages(shloka, lang),
          ...gpt5Options(model)
        })
      )
    );
  });

const grammar_analysis_route = protectedAdminProcedure
  .input(get_grammar_analysis_input_schema)
  .query(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const time = new Date();
        const out = yield* get_grammar_analysis_text(input.shloka, input.lang, input.model);
        return {
          text: out,
          time_ms: new Date().getTime() - time.getTime()
        };
      })
    )
  );

export const grammar_router = t.router({
  grammar_analysis: grammar_analysis_route
});
