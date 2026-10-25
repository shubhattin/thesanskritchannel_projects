import { Effect } from 'effect';
import { isStepCount, ToolLoopAgent, type Tool } from 'ai';
import { AiProvider } from '~/effect/ai';
import { AGENT_MODELS, AGENT_UTILITY_MODEL, type AgentModelId } from '~/agents/models';
import { agentInstructionSections, toSystemMessages } from '~/agents/prompts/instructions';
import { buildProjectsContext } from '~/agents/prompts/projects_context';
import { searchTextsTool } from '~/agents/tools/search_texts';
import { sqlQueryTool } from '~/agents/tools/sql_query';
import { createWebSearchTool } from '~/agents/tools/web_search';
import type { AgentUITools } from '~/agents/ui_message';

/** The tools as the UI message type knows them. */
export type AgentTools = {
  [Name in keyof AgentUITools]: Tool<AgentUITools[Name]['input'], AgentUITools[Name]['output']>;
};

/** Tool calls + replies per user turn. */
const MAX_STEPS = 25;

export const resolveAgentModel = Effect.fn('agents.resolve_model')(function* (
  modelId: AgentModelId
) {
  const ai = yield* AiProvider;
  const meta = AGENT_MODELS[modelId];
  return meta.provider === 'openai'
    ? ai.openaiModel(meta.providerModelId)
    : ai.openrouterModel(meta.providerModelId);
});

/** Everything the agent reads before the conversation (also shown in the Context dialog). */
export const loadInstructionSections = Effect.fn('agents.load_instructions')(function* () {
  return agentInstructionSections(yield* buildProjectsContext());
});

export const createAgent = Effect.fn('agents.create_agent')(function* (modelId: AgentModelId) {
  const model = yield* resolveAgentModel(modelId);
  const searchModel = yield* resolveAgentModel(AGENT_UTILITY_MODEL);
  const sections = yield* loadInstructionSections();
  const tools: AgentTools = {
    sql_query: sqlQueryTool,
    search_texts: searchTextsTool,
    web_search: createWebSearchTool(searchModel)
  };
  const agent = new ToolLoopAgent({
    model,
    instructions: toSystemMessages(sections),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    providerOptions: {
      openai: { reasoningEffort: 'medium', reasoningSummary: 'auto' },
      openrouter: { reasoning: { effort: 'medium' } }
    }
  });
  return { agent, tools };
});
