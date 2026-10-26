import type { UIDataTypes, UIMessage } from 'ai';
import type { AgentModelId } from './models';

/**
 * Wire types shared by the server tools and the chat UI. Kept free of runtime imports so the
 * client never pulls server code in.
 */

export type SqlQueryInput = {
  /** Few-word label shown on the collapsed tool row, e.g. "Shlokas per project". */
  purpose: string;
  query: string;
};

/** Cell as JSON text for the model: dates ISO, bigints and JSON values as text. */
export type SqlCell = string | number | boolean | null;

export type SqlQueryOutput = {
  columns: string[];
  rows: SqlCell[][];
  row_count: number;
  /** More rows (or bytes) existed than were returned. */
  truncated: boolean;
  duration_ms: number;
};

export type SearchTextsMode = 'text' | 'name';

export type SearchTextsInput = {
  query: string;
  mode: SearchTextsMode;
  /** Project keys to search; all projects when empty. */
  project_keys?: string[];
  /** Only under this path, e.g. "2" or "2:5" (1-based, colon separated). */
  path_prefix?: string;
  limit?: number;
  offset?: number;
};

export type SearchTextsHit = {
  project_key: string;
  project_name: string;
  /** DB path of the level, e.g. "2:5" ("" for the project root). */
  path: string;
  /** Level names along the path, e.g. "बालकाण्डम् › प्रथमः सर्गः". */
  location: string;
  /** Line index within the path (text mode only). */
  index: number | null;
  shloka_num: number | null;
  /** The matched line (text mode) or level name (name mode). */
  text: string;
  /** Admin app link to the line or level. */
  href: string;
};

export type SearchTextsOutput = {
  total_count: number;
  has_more: boolean;
  results: SearchTextsHit[];
};

export type WebSearchInput = { query: string };

export type WebSearchOutput = {
  summary: string;
  sources: { url: string; title?: string }[];
  /** USD charged for the search call (counted in the reply's cost) */
  cost: number;
};

export type AgentUITools = {
  sql_query: { input: SqlQueryInput; output: SqlQueryOutput };
  search_texts: { input: SearchTextsInput; output: SearchTextsOutput };
  web_search: { input: WebSearchInput; output: WebSearchOutput };
};

export type AgentMessageMetadata = {
  model?: AgentModelId;
  /**
   * USD actually charged for this reply (every model step plus web searches), as reported by
   * OpenRouter. Summed across the requests of a reply.
   */
  cost?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
  };
};

export type AgentUIMessage = UIMessage<AgentMessageMetadata, UIDataTypes, AgentUITools>;
