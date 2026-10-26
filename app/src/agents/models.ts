import { z } from 'zod';

/**
 * Models the admin agent can run, all through OpenRouter: one provider, and every reply reports
 * the actual cost charged (cache discounts included), which the chat adds up.
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
    providerModelId: 'openai/gpt-6-luna'
  },
  'gpt-6.1-sol': {
    label: 'GPT-6.1 Sol',
    hint: 'Stronger reasoning — harder questions',
    providerModelId: 'openai/gpt-6.1-sol'
  },
  'claude-sonnet-5.5': {
    label: 'Claude Sonnet 5.5',
    hint: 'Strong writer — summaries and explanations',
    providerModelId: 'anthropic/claude-sonnet-5.5'
  },
  'claude-opus-5.5': {
    label: 'Claude Opus 5.5',
    hint: 'Best quality — heavier analysis',
    providerModelId: 'anthropic/claude-opus-5.5'
  }
} as const satisfies Record<
  AgentModelId,
  { label: string; hint: string; providerModelId: string }
>;

export const agent_model_id_schema = z.enum(AGENT_MODEL_IDS);

/** Model a new chat starts with. */
export const AGENT_DEFAULT_MODEL = 'gpt-6-luna' satisfies AgentModelId;

/** Cheap model for chores: chat titles, web search summaries. */
export const AGENT_UTILITY_MODEL = 'gpt-6-luna' satisfies AgentModelId;
