import { z } from 'zod';

/**
 * Models the admin agent can run. OpenAI models go through the direct OpenAI provider
 * (Responses API); everything else through OpenRouter.
 */
export const AGENT_MODEL_IDS = [
  'gpt-6-luna',
  'gpt-6.1-sol',
  'claude-sonnet-5.5',
  'claude-opus-5.5'
] as const;

export type AgentModelId = (typeof AGENT_MODEL_IDS)[number];

export const AGENT_MODELS = {
  'gpt-6-luna': {
    label: 'GPT-6 Luna',
    hint: 'Fast and cheap — everyday questions',
    provider: 'openai',
    providerModelId: 'gpt-6-luna'
  },
  'gpt-6.1-sol': {
    label: 'GPT-6.1 Sol',
    hint: 'Stronger reasoning — harder questions',
    provider: 'openai',
    providerModelId: 'gpt-6.1-sol'
  },
  'claude-sonnet-5.5': {
    label: 'Claude Sonnet 5.5',
    hint: 'Strong writer — summaries and explanations',
    provider: 'openrouter',
    providerModelId: 'anthropic/claude-sonnet-5.5'
  },
  'claude-opus-5.5': {
    label: 'Claude Opus 5.5',
    hint: 'Best quality — heavier analysis',
    provider: 'openrouter',
    providerModelId: 'anthropic/claude-opus-5.5'
  }
} as const satisfies Record<
  AgentModelId,
  { label: string; hint: string; provider: 'openai' | 'openrouter'; providerModelId: string }
>;

export const agent_model_id_schema = z.enum(AGENT_MODEL_IDS);

/** Model a new chat starts with. */
export const AGENT_DEFAULT_MODEL = 'gpt-6-luna' satisfies AgentModelId;

/** Cheap model for chores: chat titles, web search summaries. */
export const AGENT_UTILITY_MODEL = 'gpt-6-luna' satisfies AgentModelId;
