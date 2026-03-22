import { z } from 'zod';
import { recursive_list_schema, type recursive_list_type } from './data_types';

const PROJECT_KEYS = [
  'ramayanam',
  'bhagavadgita',
  'narayaneeyam',
  'shivatandavastotram',
  'saundaryalahari',
  'veda'
] as const;
export const project_keys_enum_schema = z.enum(PROJECT_KEYS);
export type project_keys_type = z.infer<typeof project_keys_enum_schema>;

export type project_type = {
  id: number;
  name: string;
  name_dev: string;
  description?: string;
  key: project_keys_type;
  get_map: () => Promise<recursive_list_type>;
};

// ALWAYS BE CAREFUL BEFORE CHANGING THIS LIST
// AS CHANGE IN PRE-EXISTING PROJECT IDS WOULD CAUSE DATA MISMATCHs

export const PROJECT_LIST: project_type[] = [
  {
    id: 1,
    name: 'Valmiki Ramayanam',
    name_dev: 'श्रीमद्रामायणम्',
    key: 'ramayanam',
    get_map: async () =>
      recursive_list_schema.parse((await import('@data/1. ramayanam/ramayanam_map.json')).default)
  },
  {
    id: 2,
    name: 'Bhagavad Gita',
    name_dev: 'श्रीमद्भगवद्गीता',
    key: 'bhagavadgita',
    get_map: async () =>
      recursive_list_schema.parse(
        (await import('@data/2. bhagavadgita/bhagavadgita_map.json')).default
      )
  },
  {
    id: 3,
    name: 'Narayaneeyam',
    name_dev: 'नारायणीयम्',
    key: 'narayaneeyam',
    get_map: async () =>
      recursive_list_schema.parse(
        (await import('@data/3. narayaneeyam/narayaneeyam_map.json')).default
      )
  },
  {
    id: 4,
    name: 'Shiva Tandava Stotra',
    name_dev: 'शिवताण्डवस्तोत्रम्',
    key: 'shivatandavastotram',
    get_map: async () =>
      recursive_list_schema.parse(
        (await import('@data/4. shivatandavastotram/shivatandavastotram_map.json')).default
      )
  },
  {
    id: 5,
    name: 'Saundarya Lahari',
    name_dev: 'सौन्दर्यलहरी',
    key: 'saundaryalahari',
    get_map: async () =>
      recursive_list_schema.parse(
        (await import('@data/5. saundaryalahari/saundaryalahari_map.json')).default
      )
  },
  {
    id: 6,
    name: 'Veda',
    name_dev: 'वेद',
    key: 'veda',
    get_map: async () =>
      recursive_list_schema.parse((await import('@data/6. veda/veda_map.json')).default)
  }
];

export const get_project_from_id = (id: number) => {
  return PROJECT_LIST[id - 1];
};

export const get_project_from_key = (key: project_keys_type) => {
  return PROJECT_LIST[PROJECT_KEYS.indexOf(key)];
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

export type project_info_type = project_type & {
  /** The project level here also includes shloka/leaf */
  levels: number;
  /** lower -> higher, index 0 is leaf */
  level_names: string[];
};

const project_info_cache = new Map<project_keys_type, Promise<project_info_type>>();

export const get_project_info_from_key = async (
  key: project_keys_type
): Promise<project_info_type> => {
  const cached = project_info_cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const project = get_project_from_key(key);
    const map = await project.get_map();
    const levels = get_levels_from_map(map);
    const level_names = get_level_names_from_map(map);
    return {
      ...project,
      levels,
      level_names
    } satisfies project_info_type;
  })();

  project_info_cache.set(key, promise);
  promise.catch((err) => {
    // If this in-flight promise rejects, clear only if it is still the stored value.
    // This prevents transient failures from poisoning the cache, while concurrent
    // callers still share the same in-flight promise.
    if (project_info_cache.get(key) === promise) {
      project_info_cache.delete(key);
    }
    // throw err;
  });
  return promise;
};

export const get_project_info_from_id = async (id: number): Promise<project_info_type> => {
  const project = get_project_from_id(id);
  return get_project_info_from_key(project.key);
};
