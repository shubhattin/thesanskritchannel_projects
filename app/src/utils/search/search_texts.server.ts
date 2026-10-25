import { Effect } from 'effect';
import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { project_paths, texts } from '~/db/schema';
import { dbRun } from '~/effect/database';
import { get_project_map_by_id } from '~/utils/project/list.server';
import type { SearchMode } from './search_mode';
import { search_name_dev_in_maps } from './search_name_dev.server';

/**
 * The search behind `/search`: `text` matches line content (`texts.text_search`, svaras
 * stripped), `name` matches the Devanagari level names in each project map. Shared by the
 * tRPC route and the admin agent's `search_texts` tool so both return the same rows.
 */
export const search_texts_in_projects = Effect.fn('search_texts_in_projects')(function* (args: {
  project_ids: number[];
  search_text: string;
  mode: SearchMode;
  path_prefixes?: number[][];
  limit: number;
  offset: number;
}) {
  const { project_ids, search_text, mode, path_prefixes, limit, offset } = args;

  if (mode === 'name') {
    const projectMaps = yield* Effect.all(
      project_ids.map((id) =>
        Effect.gen(function* () {
          const map = yield* get_project_map_by_id(id);
          return { id, map };
        })
      ),
      { concurrency: 'unbounded' }
    );
    return search_name_dev_in_maps({
      projects: projectMaps,
      search_text,
      path_prefixes,
      limit,
      offset
    });
  }

  const conditions = [like(texts.text_search, `%${search_text}%`)];
  conditions.push(inArray(project_paths.project_id, project_ids));

  if (path_prefixes && path_prefixes.length > 0) {
    const pathConditions = path_prefixes
      .filter((pp) => pp.length > 0)
      .map((pp) => {
        const prefix = pp.join(':');
        return or(eq(project_paths.path, prefix), like(project_paths.path, `${prefix}:%`));
      });
    if (pathConditions.length > 0) {
      conditions.push(or(...pathConditions)!);
    }
  }

  const data = yield* dbRun('text.ml.1', (db) =>
    db
      .select({
        project_id: project_paths.project_id,
        path: project_paths.path,
        index: texts.index,
        shloka_num: texts.shloka_num,
        text: texts.text,
        totalCount: sql<number>`count(*) over()`
      })
      .from(texts)
      .innerJoin(project_paths, eq(texts.project_path_id, project_paths.id))
      .where(and(...conditions))
      .orderBy(project_paths.project_id, project_paths.path, texts.index)
      .limit(limit + 1)
      .offset(offset)
  );

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const totalCount = data.length ? Number(data[0].totalCount) : 0;

  return {
    items,
    page: {
      limit,
      offset,
      nextOffset: hasMore ? offset + limit : null,
      hasMore,
      totalCount
    }
  };
});
