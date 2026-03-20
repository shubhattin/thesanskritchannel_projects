import type { recursive_list_type } from '../../../src/state/data_types';
import {
  get_list_name_for_path_param_index,
  get_node_at_path,
  get_project_from_key,
  get_project_info_from_key,
  project_keys_enum_schema,
  type project_keys_type
} from '../../../src/state/project_list';

const NUMERIC_SEGMENT_RE = /^[1-9]\d*$/;
const PRETTY_SEGMENT_RE = /^(?<levelSlug>.+)-(?<num>[1-9]\d*)$/;

export const normalize_level_name_for_url = (name: string) =>
  // De-accent for stable URL slugs.
  // Example: "Bhāga" -> "bhaga" (not "bh-ga").
  name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const build_pretty_route_segment = (level_name: string, num: number) =>
  `${normalize_level_name_for_url(level_name)}-${num}`;

export const parse_pretty_route_segment = (segment: string) => {
  const match = PRETTY_SEGMENT_RE.exec(segment);
  if (!match?.groups) return null;
  const num = Number(match.groups.num);
  if (!Number.isInteger(num) || num < 1) return null;
  return {
    level_slug: match.groups.levelSlug,
    num
  };
};

export const is_numeric_route = (segments: string[]) =>
  segments.length > 0 && segments.every((segment) => NUMERIC_SEGMENT_RE.test(segment));

export const get_pretty_segments_for_path_params = (
  map: recursive_list_type,
  path_params: number[]
) => {
  const segments: string[] = [];
  for (let i = 0; i < path_params.length; i++) {
    const num = path_params[i]!;
    const level_name = get_list_name_for_path_param_index(map, path_params, i, 'Level');
    const parent_node = i === 0 ? map : get_node_at_path(map, path_params.slice(0, i));
    if (!parent_node || parent_node.info.type !== 'list') return null;
    const list = parent_node.list ?? [];
    if (!(num >= 1 && num <= list.length)) return null;
    segments.push(build_pretty_route_segment(level_name, num));
  }
  return segments;
};

export const build_project_path = (
  project_key: project_keys_type,
  map: recursive_list_type,
  path_params: number[]
) => {
  const segments = get_pretty_segments_for_path_params(map, path_params);
  if (!segments) return null;
  return segments.length === 0 ? `/${project_key}` : `/${project_key}/${segments.join('/')}`;
};

export const resolve_substitute_url = (_url: string) => null;

export type resolved_text_route_type = {
  project_key: project_keys_type;
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

export const resolve_text_route = async (
  raw_project_key: string,
  raw_segments: string[]
): Promise<resolved_text_route_type | null> => {
  const parsed_project_key = project_keys_enum_schema.safeParse(raw_project_key);
  if (!parsed_project_key.success) return null;

  const project_key = parsed_project_key.data;
  const project = get_project_from_key(project_key);
  const project_info = await get_project_info_from_key(project_key);
  const map = await project.get_map();
  const segments = raw_segments.filter((segment) => segment.length > 0);

  if (segments.length > project_info.levels - 1) return null;

  if (is_numeric_route(segments)) {
    const path_params = segments.map((segment) => Number(segment));
    const canonical_path = build_project_path(project_key, map, path_params);
    if (!canonical_path) return null;
    return {
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
    };
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
    redirect_to: null
  };
};

export const get_child_route_items = (
  project_key: project_keys_type,
  map: recursive_list_type,
  path_params: number[]
) => {
  const node = path_params.length === 0 ? map : get_node_at_path(map, path_params);
  if (!node || node.info.type !== 'list') return [];

  return (node.list ?? []).map((child, index) => {
    const next_path_params = [...path_params, index + 1];
    const href = build_project_path(project_key, map, next_path_params);
    return {
      index: index + 1,
      href: href ?? `/${project_key}`,
      name_dev: child.name_dev,
      name_nor: child.name_nor,
      is_leaf: child.info.type === 'shloka'
    };
  });
};

export const get_selected_text_levels_from_path_params = (
  path_params: number[],
  levels: number
) => {
  return path_params.slice(0, levels - 1).reverse() as (number | null)[];
};
