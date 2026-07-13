import { createOpenAI } from '@ai-sdk/openai';
import { env } from '$env/dynamic/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import type { ai_text_models_type } from './ai_types';
import { createS3Client } from '~/utils/s3/upload_file.server';

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
  'gpt-5.2': openrouter('openai/gpt-5.2')
} satisfies Record<ai_text_models_type, LanguageModel>;

export const text_model_custom_options = {
  'gpt-5.2': {
    providerOptions: {
      openrouter: {
        reasoningEffort: 'low'
      }
    }
  },
  'gpt-5.6-terra': {
    providerOptions: {
      openrouter: {
        reasoningEffort: 'low'
      }
    }
  }
} as Partial<Record<ai_text_models_type, object>>;

export const s3Client = createS3Client({
  envs: {
    AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: env.AWS_REGION,
    AWS_S3_FILES_BUCKET_NAME: env.AWS_S3_FILES_BUCKET_NAME
  }
});
