import { AGENT_MODELS } from '~/agents/models';
import type { AgentMessageMetadata } from '~/agents/ui_message';

/** Dollars with enough precision for small amounts: $0.0042, $0.042, $1.23. */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);

export function usageLine(usage: AgentMessageMetadata['usage']): string | null {
  if (!usage) return null;
  const parts = [`${compact(usage.inputTokens ?? 0)} in`];
  if (usage.cachedInputTokens) parts.push(`${compact(usage.cachedInputTokens)} cached`);
  parts.push(`${compact(usage.outputTokens ?? 0)} out`);
  if (usage.reasoningTokens) parts.push(`${compact(usage.reasoningTokens)} reasoning`);
  return parts.join(' · ');
}

export function modelLabel(model: AgentMessageMetadata['model']): string | null {
  if (!model) return null;
  return AGENT_MODELS[model]?.label ?? model;
}
