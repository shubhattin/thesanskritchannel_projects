import { createOpenAI } from '@ai-sdk/openai';
import { env } from '$env/dynamic/private';

/** OpenAI provider for image generation (not OpenRouter). */
export const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

export const OPENAI_IMAGE_MODELS = {
  'gpt-image-1': 'gpt-image-1',
  'gpt-image-2': 'gpt-image-2',
  default: 'gpt-image-2'
} as const;
