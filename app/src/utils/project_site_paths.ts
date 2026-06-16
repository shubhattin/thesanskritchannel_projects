import type { recursive_list_type } from '../state/data_types';
import { get_list_name_for_path_param_index, get_node_at_path } from '../state/project_list';

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
  project_key: string,
  map: recursive_list_type,
  path_params: number[]
) => {
  const segments = get_pretty_segments_for_path_params(map, path_params);
  if (!segments) return null;
  return segments.length === 0 ? `/${project_key}` : `/${project_key}/${segments.join('/')}`;
};
