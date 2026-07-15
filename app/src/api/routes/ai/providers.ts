import { createOpenAI } from '@ai-sdk/openai';
import { env } from '$env/dynamic/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { DEFAULT_TEXT_AI_MODEL, type ai_text_models_type } from './ai_types';

/** OpenAI provider for image generation (not OpenRouter). */
export const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

export const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

export const OPENAI_IMAGE_MODELS = {
  'gpt-image-1': 'gpt-image-1',
  'gpt-image-2': 'gpt-image-2',
  default: 'gpt-image-2'
} as const;

export const OPENROUTER_TEXT_MODELS = {
  'gpt-5.6-terra': openrouter('openai/gpt-5.6-terra'),
  'gpt-5.2': openrouter('openai/gpt-5.2'),
  'gpt-5.6-luna': openrouter('openai/gpt-5.6-luna'),
  'gpt-5.6-sol': openrouter('openai/gpt-5.6-sol')
} satisfies Record<ai_text_models_type, LanguageModel>;

/** Default Balanced Model for translation work */
export const DEFAULT_OPENROUTER_TEXT_MODEL = DEFAULT_TEXT_AI_MODEL;

export const OPENROUTER_OPENAI_LOW_REASONING_CONFIG = {
  providerOptions: {
    openrouter: {
      reasoningEffort: 'low'
    }
  }
} as const;
export const text_model_custom_options = {
  'gpt-5.6-luna': OPENROUTER_OPENAI_LOW_REASONING_CONFIG,
  'gpt-5.6-sol': OPENROUTER_OPENAI_LOW_REASONING_CONFIG,
  'gpt-5.6-terra': OPENROUTER_OPENAI_LOW_REASONING_CONFIG,
  'gpt-5.2': OPENROUTER_OPENAI_LOW_REASONING_CONFIG
} as Partial<Record<ai_text_models_type, object>>;
