import { Effect } from 'effect';
import { get_level_names_from_map } from '~/state/project_list';
import { get_project_list, get_project_map_by_id } from '~/utils/project/list.server';

/**
 * One line per project: id, key, names, visibility and level names (highest first), so the
 * agent can pick `project_keys` and read paths without a query first.
 */
export const buildProjectsContext = Effect.fn('agents.build_projects_context')(function* () {
  const projects = yield* get_project_list();
  const lines = yield* Effect.all(
    projects.map((project) =>
      get_project_map_by_id(project.id).pipe(
        Effect.map((map) => get_level_names_from_map(map).toReversed().join(' → ')),
        Effect.orElseSucceed(() => 'unknown'),
        Effect.map(
          (levels) =>
            `- id=${project.id} key=${project.key} — ${project.name_dev} (${project.name})${project.listed ? '' : ' [unlisted]'} — levels: ${levels}`
        )
      )
    ),
    { concurrency: 'unbounded' }
  );
  return lines.length > 0 ? lines.join('\n') : '(no projects yet)';
});
