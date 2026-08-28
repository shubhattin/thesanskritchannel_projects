import { Effect } from 'effect';
import type { LanguageModel } from 'ai';
import { DEFAULT_TEXT_AI_MODEL, type ai_text_models_type } from './ai_types';
import { AiProvider } from '~/effect/ai';

export const OPENAI_IMAGE_MODELS = {
  'gpt-image-1': 'gpt-image-1',
  'gpt-image-2': 'gpt-image-2',
  default: 'gpt-image-2'
} as const;

export const OPENROUTER_TEXT_MODEL_IDS = {
  'gpt-5.6-terra': 'openai/gpt-5.6-terra',
  'gpt-5.2': 'openai/gpt-5.2',
  'gpt-5.6-luna': 'openai/gpt-5.6-luna',
  'gpt-5.6-sol': 'openai/gpt-5.6-sol'
} as const satisfies Record<ai_text_models_type, string>;

/** Resolve OpenRouter text model via AiProvider (no $env). */
export const resolveOpenRouterTextModel = (
  model: ai_text_models_type
): Effect.Effect<LanguageModel, never, AiProvider> =>
  Effect.gen(function* () {
    const ai = yield* AiProvider;
    return ai.openrouterModel(OPENROUTER_TEXT_MODEL_IDS[model]);
  });

/** Default Balanced Model for translation work */
export const DEFAULT_OPENROUTER_TEXT_MODEL = DEFAULT_TEXT_AI_MODEL;

export const OPENROUTER_OPENAI_LOW_REASONING_CONFIG = {
  providerOptions: {
    openrouter: {
      reasoningEffort: 'low'
    }
  }
} as const;
/** Per-model provider overrides; absent models run with defaults. */
type TextModelCustomOptions = {
  [M in ai_text_models_type]?: typeof OPENROUTER_OPENAI_LOW_REASONING_CONFIG;
};

export const text_model_custom_options: TextModelCustomOptions = {
  'gpt-5.6-luna': OPENROUTER_OPENAI_LOW_REASONING_CONFIG,
  'gpt-5.6-sol': OPENROUTER_OPENAI_LOW_REASONING_CONFIG,
  'gpt-5.6-terra': OPENROUTER_OPENAI_LOW_REASONING_CONFIG,
  'gpt-5.2': OPENROUTER_OPENAI_LOW_REASONING_CONFIG
};
