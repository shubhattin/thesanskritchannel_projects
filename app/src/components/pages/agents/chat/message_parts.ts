import type { AgentUIMessage, AgentUITools } from '~/agents/ui_message';

export type AgentPart = AgentUIMessage['parts'][number];

export type AgentToolPart<N extends keyof AgentUITools> = Extract<AgentPart, { type: `tool-${N}` }>;

/** Parts shown as rows of the step trace (thinking and tool calls). */
export type StepPart =
  | Extract<AgentPart, { type: 'reasoning' }>
  | AgentToolPart<'sql_query'>
  | AgentToolPart<'search_texts'>
  | AgentToolPart<'web_search'>;

export type PartGroup =
  | { kind: 'steps'; key: string; parts: StepPart[] }
  | { kind: 'text'; key: string; text: string };

const isStep = (part: AgentPart): part is StepPart =>
  part.type === 'reasoning' ||
  part.type === 'tool-sql_query' ||
  part.type === 'tool-search_texts' ||
  part.type === 'tool-web_search';

/** Consecutive steps share one trace; text stands on its own. */
export function groupParts(parts: AgentPart[]): PartGroup[] {
  const groups: PartGroup[] = [];
  parts.forEach((part, index) => {
    if (isStep(part)) {
      const last = groups.at(-1);
      if (last?.kind === 'steps') last.parts.push(part);
      else groups.push({ kind: 'steps', key: `steps-${index}`, parts: [part] });
    } else if (part.type === 'text' && part.text.trim()) {
      groups.push({ kind: 'text', key: `text-${index}`, text: part.text });
    }
  });
  return groups;
}

export function messageText(message: AgentUIMessage) {
  return message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
}

/** Between steps (a tool finished, the next step has not streamed yet) work still continues. */
export function isWaitingForNextStep(message: AgentUIMessage) {
  const lastPart = message.parts.filter((part) => part.type !== 'step-start').at(-1);
  if (!lastPart) return true;
  if (lastPart.type === 'reasoning') return lastPart.state === 'done';
  if (
    lastPart.type === 'tool-sql_query' ||
    lastPart.type === 'tool-search_texts' ||
    lastPart.type === 'tool-web_search'
  ) {
    return lastPart.state === 'output-available' || lastPart.state === 'output-error';
  }
  return false;
}
