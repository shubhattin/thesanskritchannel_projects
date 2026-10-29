import type { SystemModelMessage } from 'ai';
import { describeDatabaseSchema } from '~/agents/db_schema/describe_schema';
import { GENERAL_SYSTEM_PROMPT } from './general';
import { buildLanguagesContext } from './languages';

export type InstructionSection = {
  id: 'system_prompt' | 'database_schema' | 'languages' | 'projects' | 'site';
  title: string;
  content: string;
};

/**
 * Everything the agent reads before the conversation, most stable first: system prompt, the
 * database schema, the language ids, then the project catalog. The cache breakpoint goes after the
 * last section, so every turn of a chat reuses the whole prefix while the catalog is unchanged.
 */
export function agentInstructionSections(
  projectsText: string,
  siteText: string
): InstructionSection[] {
  return [
    { id: 'system_prompt', title: 'System prompt', content: GENERAL_SYSTEM_PROMPT },
    {
      id: 'database_schema',
      title: 'Database schema',
      content: `<database_schema>\n${describeDatabaseSchema()}\n</database_schema>`
    },
    {
      id: 'languages',
      title: 'Languages',
      content: `<languages>\n${buildLanguagesContext()}\n</languages>`
    },
    { id: 'projects', title: 'Projects', content: `<projects>\n${projectsText}\n</projects>` },
    { id: 'site', title: 'Site links', content: `<site>\n${siteText}\n</site>` }
  ];
}

export function toSystemMessages(sections: InstructionSection[]): SystemModelMessage[] {
  const messages: SystemModelMessage[] = sections.map((section) => ({
    role: 'system',
    content: section.content
  }));
  // OpenAI caches prefixes automatically; Anthropic (via OpenRouter) needs the breakpoint.
  const last = messages.at(-1);
  if (last) last.providerOptions = { openrouter: { cacheControl: { type: 'ephemeral' } } };
  return messages;
}
