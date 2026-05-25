import { type recursive_list_type } from './data_types';

export type project_type_client = {
  id: number;
  name: string;
  name_dev: string;
  description?: string;
  key: string;
};

export const get_project_from_id = <T extends project_type_client>(
  id: number,
  project_list: readonly T[]
): T | undefined => {
  return project_list.find((p) => p.id === id);
};

export const get_project_from_key = <T extends project_type_client>(
  key: string,
  project_list: readonly T[]
): T | undefined => {
  return project_list.find((p) => p.key === key);
};

export const clamp_levels_for_route = (levels: number) => {
  return levels;
};

export const get_levels_from_map = (map: recursive_list_type): number => {
  if (map.info.type === 'shloka') return 1;
  const children = map.list ?? [];
  if (children.length === 0) return 2; // list level + leaf (fallback)
  let max_child_depth = 1;
  for (const child of children) {
    const d = get_levels_from_map(child);
    if (d > max_child_depth) max_child_depth = d;
  }
  return 1 + max_child_depth;
};

const get_list_names_high_to_low = (map: recursive_list_type): string[] => {
  if (map.info.type !== 'list') return [];
  const current = map.info.list_name;
  const children = map.list ?? [];
  if (children.length === 0) return [current];

  // pick a canonical deepest path so names match max depth
  let best_child: recursive_list_type | null = null;
  let best_depth = -1;
  for (const child of children) {
    const d = get_levels_from_map(child);
    if (d > best_depth) {
      best_depth = d;
      best_child = child;
    }
  }
  if (!best_child) return [current];
  return [current, ...get_list_names_high_to_low(best_child)];
};

export const get_level_names_from_map = (
  map: recursive_list_type,
  leaf_level_name = 'Shloka'
): string[] => {
  // returns lower -> higher (index 0 is the leaf/shloka level)
  const list_names_high_to_low = get_list_names_high_to_low(map);
  return [leaf_level_name, ...list_names_high_to_low.reverse()];
};

export const get_node_at_path = (map: recursive_list_type, path_params: number[]) => {
  // path_params are higher -> lower, matching URL params: /kanda/sarga/...
  let node: recursive_list_type = map;
  for (const sel of path_params) {
    if (node.info.type !== 'list') return null;
    const list = node.list ?? [];
    if (!(sel >= 1 && sel <= list.length)) return null;
    node = list[sel - 1]!;
  }
  return node;
};

export const get_list_node_at_depth_from_selected = (
  map: recursive_list_type,
  levels: number,
  selected_text_levels: (number | null)[],
  depth: number
): recursive_list_type | null => {
  // depth: 0 -> root list (highest selector), 1 -> list under highest selection, etc.
  // selected_text_levels is lower -> higher (index 0 is the lowest route param).
  let node: recursive_list_type = map;
  for (let d = 0; d < depth; d++) {
    const sel = selected_text_levels[levels - 2 - d];
    if (!sel) return null;
    if (node.info.type !== 'list') return null;
    const list = node.list ?? [];
    if (!(sel >= 1 && sel <= list.length)) return null;
    node = list[sel - 1]!;
  }
  return node.info.type === 'list' ? node : null;
};

export const get_map_list_at_depth = (
  map: recursive_list_type,
  levels: number,
  selected_text_levels: (number | null)[],
  depth: number
): recursive_list_type[] | null => {
  const node = get_list_node_at_depth_from_selected(map, levels, selected_text_levels, depth);
  if (!node || node.info.type !== 'list') return null;
  return Array.isArray(node.list) ? node.list : null;
};

export const get_list_name_at_depth_from_selected = (
  map: recursive_list_type,
  levels: number,
  selected_text_levels: (number | null)[],
  depth: number,
  fallback = 'Level'
): string => {
  const node = get_list_node_at_depth_from_selected(map, levels, selected_text_levels, depth);
  return node?.info.type === 'list' ? node.info.list_name : fallback;
};

export const get_list_name_for_path_param_index = (
  map: recursive_list_type,
  path_params: number[],
  index: number,
  fallback = 'Level'
): string => {
  // path_params are higher -> lower (matching the route segments).
  // index is the param we are about to validate (0 is the highest selector).
  let node: recursive_list_type = map;
  for (let i = 0; i < index; i++) {
    if (node.info.type !== 'list') return fallback;
    const list = node.list ?? [];
    const sel = path_params[i]!;
    if (!(sel >= 1 && sel <= list.length)) return fallback;
    node = list[sel - 1]!;
  }
  return node.info.type === 'list' ? node.info.list_name : fallback;
};

export const get_list_length_for_last_param = (map: recursive_list_type, path_params: number[]) => {
  if (path_params.length === 0) return null;
  let node: recursive_list_type = map;
  for (let i = 0; i < path_params.length; i++) {
    if (node.info.type !== 'list') return null;
    const list = node.list ?? [];
    const sel = path_params[i]!;
    if (!(sel >= 1 && sel <= list.length)) return null;
    if (i === path_params.length - 1) return list.length;
    node = list[sel - 1]!;
  }
  return null;
};

export const get_path_params = (
  selected_text_levels: (number | null)[],
  project_levels: number
) => {
  return selected_text_levels.slice(0, project_levels - 1).reverse() as number[];
};

export type project_info_type = project_type_client & {
  /** The project level here also includes shloka/leaf */
  levels: number;
  /** lower -> higher, index 0 is leaf */
  level_names: string[];
};

export const build_project_info = (
  project: project_type_client,
  map: recursive_list_type
): project_info_type => ({
  ...project,
  levels: get_levels_from_map(map),
  level_names: get_level_names_from_map(map)
});
