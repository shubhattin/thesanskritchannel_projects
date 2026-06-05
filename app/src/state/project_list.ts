import { type recursive_list_type } from './data_types';

export type project_type = {
  id: number;
  name: string;
  name_dev: string;
  description?: string | null;
  key: string;
  listed: boolean;
};

export type project_registry_type = {
  list: readonly project_type[];
  byId: ReadonlyMap<number, project_type>;
  byKey: ReadonlyMap<string, project_type>;
};

export const build_project_registry = (
  projects: readonly project_type[]
): project_registry_type => {
  const byId = new Map<number, project_type>();
  const byKey = new Map<string, project_type>();

  for (const project of projects) {
    if (byId.has(project.id)) {
      throw new Error(`Duplicate project id: ${project.id}`);
    }
    if (byKey.has(project.key)) {
      throw new Error(`Duplicate project key: ${project.key}`);
    }
    byId.set(project.id, project);
    byKey.set(project.key, project);
  }

  return { list: projects, byId, byKey };
};

export const EMPTY_PROJECT_REGISTRY = build_project_registry([]);

export const get_project_from_id = (
  id: number,
  registry: project_registry_type
): project_type | undefined => {
  return registry.byId.get(id);
};

export const get_project_from_key = (
  key: string,
  registry: project_registry_type
): project_type | undefined => {
  return registry.byKey.get(key);
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

export const get_level_names_from_map = (
  map: recursive_list_type,
  leaf_level_name = 'Shloka'
): string[] => {
  // returns lower -> higher (index 0 is the leaf/shloka level)
  const collect_list_names_high_to_low = (node: recursive_list_type): string[] => {
    if (node.info.type !== 'list') return [];
    const current = node.info.list_name;
    const children = node.list ?? [];
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
    return [current, ...collect_list_names_high_to_low(best_child)];
  };

  const list_names_high_to_low = collect_list_names_high_to_low(map);
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

/** 1-based path segment for a child at `index` (replaces stored `pos` on map nodes). */
export const list_item_path_value = (index: number) => index + 1;

/** List node with no children (used to block drill-down in nav; not for shloka leaves). */
export const is_empty_list_branch = (node: recursive_list_type) =>
  node.info.type === 'list' && (!Array.isArray(node.list) || node.list.length === 0);

/** Whether a child should be shown as blocked in selectors / site nav (mirrors MainApp depth rules). */
export const is_child_nav_disabled = (
  child: recursive_list_type,
  path_params_length: number,
  levels: number
) => path_params_length < levels - 2 && is_empty_list_branch(child);

export type map_selector_option_type = {
  text: string;
  value: number;
  empty_child?: boolean;
};

export const map_list_nodes_to_selector_options = (
  items: readonly recursive_list_type[],
  { mark_empty_child = false }: { mark_empty_child?: boolean } = {}
): map_selector_option_type[] =>
  items.map((node, index) => ({
    text: node.name_dev,
    value: list_item_path_value(index),
    ...(mark_empty_child && { empty_child: is_empty_list_branch(node) })
  }));

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
  const params = selected_text_levels.slice(0, project_levels - 1).reverse();
  while (params.length && params[params.length - 1] == null) params.pop();
  if (params.some((v) => v == null)) return [];
  return params as number[];
};

export type project_info_type = project_type & {
  /** The project level here also includes shloka/leaf */
  levels: number;
  /** lower -> higher, index 0 is leaf */
  level_names: string[];
};

export const build_project_info = (
  project: project_type,
  map: recursive_list_type
): project_info_type => ({
  ...project,
  levels: get_levels_from_map(map),
  level_names: get_level_names_from_map(map)
});
