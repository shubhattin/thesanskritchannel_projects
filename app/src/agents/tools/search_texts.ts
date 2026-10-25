import { tool, type Tool } from 'ai';
import { Effect } from 'effect';
import { z } from 'zod';
import type { SearchTextsInput, SearchTextsOutput } from '~/agents/ui_message';
import { BadRequestError } from '~/effect/errors';
import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';
import { DB_PATH_RE, dbPathToPathParams } from '~/utils/map_path/swap';
import { remove_vedic_svara_chihnAni } from '~/utils/normalize_text';
import { get_project_list, get_project_map_by_id } from '~/utils/project/list.server';
import {
  build_search_result_href,
  build_search_result_path_href
} from '~/utils/search/search_result_link';
import { search_texts_in_projects } from '~/utils/search/search_texts.server';
import { runToolEffect } from './run_tool_effect';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Level names from the root's child down to `path`, e.g. "बालकाण्डम् › प्रथमः सर्गः". */
const locationOf = (map: recursive_list_type, path: string) => {
  if (!path) return map.name_dev;
  const params = dbPathToPathParams(path);
  const names: string[] = [];
  for (let depth = 1; depth <= params.length; depth++) {
    const node = get_node_at_path(map, params.slice(0, depth));
    names.push(node?.name_dev || String(params[depth - 1]));
  }
  return names.join(' › ');
};

const searchTexts = Effect.fn('agents.search_texts')(function* (input: SearchTextsInput) {
  const query = remove_vedic_svara_chihnAni(input.query).trim();
  if (!query) {
    return yield* Effect.fail(BadRequestError.make({ message: 'The query is empty.' }));
  }
  const path_prefix = input.path_prefix?.trim() || undefined;
  if (path_prefix && !DB_PATH_RE.test(path_prefix)) {
    return yield* Effect.fail(
      BadRequestError.make({ message: `path_prefix "${path_prefix}" must look like "2" or "2:5".` })
    );
  }

  const all = yield* get_project_list();
  const keys = input.project_keys?.filter(Boolean) ?? [];
  const projects = keys.length === 0 ? all : all.filter((project) => keys.includes(project.key));
  const unknown = keys.filter((key) => !all.some((project) => project.key === key));
  if (unknown.length > 0) {
    return yield* Effect.fail(
      BadRequestError.make({
        message: `Unknown project key(s): ${unknown.join(', ')}. Valid keys: ${all.map((p) => p.key).join(', ')}`
      })
    );
  }

  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const result = yield* search_texts_in_projects({
    project_ids: projects.map((project) => project.id),
    search_text: query,
    mode: input.mode,
    path_prefixes: path_prefix ? [dbPathToPathParams(path_prefix)] : undefined,
    limit,
    offset: Math.max(input.offset ?? 0, 0)
  });

  const byId = new Map(projects.map((project) => [project.id, project]));
  const hitIds = [...new Set(result.items.map((item) => item.project_id))];
  const maps = new Map(
    yield* Effect.all(
      hitIds.map((id) => get_project_map_by_id(id).pipe(Effect.map((map) => [id, map] as const))),
      { concurrency: 'unbounded' }
    )
  );

  return {
    total_count: result.page.totalCount,
    has_more: result.page.hasMore,
    results: result.items.map((item) => {
      const project = byId.get(item.project_id)!;
      const map = maps.get(item.project_id);
      return {
        project_key: project.key,
        project_name: project.name_dev || project.name,
        path: item.path,
        location: map ? locationOf(map, item.path) : item.path,
        index: item.index,
        shloka_num: item.shloka_num,
        text: item.text,
        href:
          item.index === null
            ? build_search_result_path_href(project.key, item.path)
            : build_search_result_href(project.key, item.path, item.index)
      };
    })
  } satisfies SearchTextsOutput;
});

export const searchTextsTool: Tool<SearchTextsInput, SearchTextsOutput> = tool({
  description: `Search the texts exactly like the admin /search page.
- mode "text": lines whose content contains the query (substring match, Vedic svara marks ignored). Write the query in Devanagari, as the texts are stored. % and _ act as LIKE wildcards.
- mode "name": level names (kāṇḍa, sarga, adhyāya, sūkta… names in Devanagari) that contain the query.
Returns each hit with its project, level location, line index, shloka number and an app link.`,
  inputSchema: z.object({
    query: z.string().min(1).max(500).describe('Devanagari text to find'),
    mode: z.enum(['text', 'name']).describe('"text" = line content, "name" = level names'),
    project_keys: z
      .array(z.string())
      .optional()
      .describe('Project keys to search (from <projects>); omit to search all'),
    path_prefix: z
      .string()
      .optional()
      .describe('Only under this level, as a 1-based colon path like "2" or "2:5"'),
    limit: z.int().min(1).max(MAX_LIMIT).optional().describe(`Default ${DEFAULT_LIMIT}`),
    offset: z.int().min(0).optional().describe('For paging through more hits')
  }),
  execute: (input) => runToolEffect(searchTexts(input))
});
