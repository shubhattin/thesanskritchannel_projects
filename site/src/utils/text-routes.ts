import { Effect } from 'effect';
import type { recursive_list_type } from '../../../app/src/state/data_types';
import {
  get_list_name_for_path_param_index,
  get_node_at_path,
  is_child_nav_disabled,
  list_item_path_value
} from '$app/state/project_list';
import {
  build_project_path,
  is_numeric_route,
  normalize_level_name_for_url,
  parse_pretty_route_segment
} from '$app/utils/project_site_paths';
import {
  getProjectInfoByKey,
  getProjectMapByKey,
  resolveProjectByKey
} from '$app/effect/project_registry';

export {
  build_project_path,
  build_pretty_route_segment,
  get_pretty_segments_for_path_params,
  is_numeric_route,
  normalize_level_name_for_url,
  parse_pretty_route_segment
} from '$app/utils/project_site_paths';

export const resolve_substitute_url = (_url: string) => null;

export type resolved_text_route_type = {
  project_id: number;
  project_key: string;
  project_name: string;
  level_names: string[];
  levels: number;
  map: recursive_list_type;
  node: recursive_list_type;
  path_params: number[];
  path_names: string[];
  path_level_names: string[];
  canonical_path: string;
  redirect_to: string | null;
};

/** Domain Effect — run only at an Astro page/endpoint boundary. */
export const resolve_text_route = (raw_project_key: string, raw_segments: string[]) =>
  Effect.gen(function* () {
    const resolved_project = yield* resolveProjectByKey(raw_project_key, { listed_only: true });
    if (!resolved_project) return null;

    const project = resolved_project.project;
    const project_key = project.key;
    const key_changed = resolved_project.was_redirect;
    const project_info = yield* getProjectInfoByKey(project_key);
    const map = yield* getProjectMapByKey(project_key);
    const segments = raw_segments.filter((segment) => segment.length > 0);

    if (segments.length > project_info.levels - 1) return null;

    if (is_numeric_route(segments)) {
      const path_params = segments.map((segment) => Number(segment));
      const canonical_path = build_project_path(project_key, map, path_params);
      if (!canonical_path) return null;
      return {
        project_id: project.id,
        project_key,
        project_name: project.name,
        level_names: project_info.level_names.slice(0, project_info.levels),
        levels: project_info.levels,
        map,
        node: get_node_at_path(map, path_params) ?? map,
        path_params,
        path_names: [],
        path_level_names: [],
        canonical_path,
        redirect_to: canonical_path
      } satisfies resolved_text_route_type;
    }

    const path_params: number[] = [];
    const path_names: string[] = [];
    const path_level_names: string[] = [];
    let node: recursive_list_type = map;

    for (const segment of segments) {
      if (node.info.type !== 'list') return null;
      const parsed_segment = parse_pretty_route_segment(segment);
      if (!parsed_segment) return null;

      const expected_level_name = get_list_name_for_path_param_index(
        map,
        [...path_params, parsed_segment.num],
        path_params.length,
        'Level'
      );
      const expected_slug = normalize_level_name_for_url(expected_level_name);
      if (parsed_segment.level_slug !== expected_slug) return null;

      const list = node.list ?? [];
      if (!(parsed_segment.num >= 1 && parsed_segment.num <= list.length)) return null;

      node = list[parsed_segment.num - 1]!;
      path_params.push(parsed_segment.num);
      path_names.push(node.name_dev);
      path_level_names.push(expected_level_name);
    }

    const canonical_path = build_project_path(project_key, map, path_params);
    if (!canonical_path) return null;

    return {
      project_id: project.id,
      project_key,
      project_name: project.name,
      level_names: project_info.level_names.slice(0, project_info.levels),
      levels: project_info.levels,
      map,
      node,
      path_params,
      path_names,
      path_level_names,
      canonical_path,
      redirect_to: key_changed ? canonical_path : null
    } satisfies resolved_text_route_type;
  });

export const get_child_route_items = (
  project_key: string,
  map: recursive_list_type,
  path_params: number[],
  levels: number
) => {
  const node = path_params.length === 0 ? map : get_node_at_path(map, path_params);
  if (!node || node.info.type !== 'list') return [];

  return (node.list ?? []).map((child, index) => {
    const path_value = list_item_path_value(index);
    const next_path_params = [...path_params, path_value];
    const href = build_project_path(project_key, map, next_path_params);
    const is_leaf = child.info.type === 'shloka';
    return {
      index: path_value,
      href: href ?? `/${project_key}`,
      name_dev: child.name_dev,
      is_leaf,
      is_disabled: is_child_nav_disabled(child, path_params.length, levels)
    };
  });
};

export const get_selected_text_levels_from_path_params = (
  path_params: number[],
  levels: number
) => {
  return path_params.slice(0, levels - 1).reverse() as (number | null)[];
};
