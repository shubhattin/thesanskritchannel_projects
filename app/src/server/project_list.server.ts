import ms from 'ms';
import { recursive_list_schema, type recursive_list_type } from '../state/data_types';
import {
  get_level_names_from_map,
  get_levels_from_map,
  type project_info_type
} from '../state/project_list';

export type project_type_server = {
  id: number;
  name: string;
  name_dev: string;
  description?: string;
  key: string;
};

type project_type_server_ = project_type_server & {
  get_map: () => Promise<recursive_list_type>;
};

const PROJECT_LIST: project_type_server_[] = [
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
    key: 'shiva-tandava-stotram',
    get_map: async () =>
      recursive_list_schema.parse(
        (await import('@data/4. shiva-tandava-stotram/shiva-tandava-stotram_map.json')).default
      )
  },
  {
    id: 5,
    name: 'Saundarya Lahari',
    name_dev: 'सौन्दर्यलहरी',
    key: 'saundarya-lahari',
    get_map: async () =>
      recursive_list_schema.parse(
        (await import('@data/5. saundarya-lahari/saundarya-lahari_map.json')).default
      )
  },
  {
    id: 6,
    name: 'Veda',
    name_dev: 'वेद',
    key: 'veda',
    get_map: async () =>
      recursive_list_schema.parse((await import('@data/6. veda/veda_map.json')).default)
  },
  {
    id: 7,
    name: 'Vijnana Bhairava Tantra',
    name_dev: 'विज्ञानभैरवतन्त्रम्',
    key: 'vijnana-bhairava-tantram',
    get_map: async () =>
      recursive_list_schema.parse(
        (await import('@data/7. vijnana-bhairava-tantram/vijnana-bhairava-tantram_map.json'))
          .default
      )
  }
];

const PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS = ms('12hours');

type ProjectListCache = {
  value: project_type_server[] | null;
  fetchedAt: number;
  inFlight: Promise<project_type_server[]> | null;
};

const list_cache: ProjectListCache = {
  value: null,
  fetchedAt: 0,
  inFlight: null
};

type MapCacheEntry = {
  value: recursive_list_type | null;
  fetchedAt: number;
  inFlight: Promise<recursive_list_type> | null;
};

const map_cache = new Map<number, MapCacheEntry>();

const is_cache_fresh = (fetchedAt: number) =>
  Date.now() - fetchedAt < PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS;

const load_project_list_from_source = async (): Promise<project_type_server[]> => {
  return PROJECT_LIST.map(({ id, name, name_dev, description, key }) => ({
    id,
    name,
    name_dev,
    description,
    key
  }));
};

/** Cached project metadata list (respects PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS). */
export const get_project_list = async (): Promise<readonly project_type_server[]> => {
  if (list_cache.value && is_cache_fresh(list_cache.fetchedAt)) {
    return list_cache.value;
  }
  if (list_cache.inFlight) return list_cache.inFlight;

  list_cache.inFlight = load_project_list_from_source()
    .then((value) => {
      list_cache.value = value;
      list_cache.fetchedAt = Date.now();
      list_cache.inFlight = null;
      return value;
    })
    .catch((err) => {
      list_cache.inFlight = null;
      throw err;
    });

  return list_cache.inFlight;
};

const get_internal_project_by_id = (id: number) => PROJECT_LIST.find((p) => p.id === id);
const get_internal_project_by_key = (key: string) => PROJECT_LIST.find((p) => p.key === key);

export const get_project_by_id = async (id: number) => {
  const list = await get_project_list();
  return list.find((p) => p.id === id);
};

export const get_project_by_key = async (key: string) => {
  const list = await get_project_list();
  return list.find((p) => p.key === key);
};

export const get_project_map_by_id = async (id: number): Promise<recursive_list_type> => {
  const internal = get_internal_project_by_id(id);
  if (!internal) throw new Error(`Project not found: ${id}`);
  return get_project_map_by_key(internal.key);
};

export const get_project_map_by_key = async (key: string): Promise<recursive_list_type> => {
  const internal = get_internal_project_by_key(key);
  if (!internal) throw new Error(`Project not found: ${key}`);

  let entry = map_cache.get(internal.id);
  if (!entry) {
    entry = { value: null, fetchedAt: 0, inFlight: null };
    map_cache.set(internal.id, entry);
  }

  if (entry.value && is_cache_fresh(entry.fetchedAt)) {
    return entry.value;
  }
  if (entry.inFlight) return entry.inFlight;

  entry.inFlight = internal
    .get_map()
    .then((value) => {
      entry!.value = value;
      entry!.fetchedAt = Date.now();
      entry!.inFlight = null;
      return value;
    })
    .catch((err) => {
      entry!.inFlight = null;
      throw err;
    });

  return entry.inFlight;
};

const project_info_cache = new Map<string, Promise<project_info_type>>();

export const get_project_info_by_key = async (key: string): Promise<project_info_type> => {
  const cached = project_info_cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const project = await get_project_by_key(key);
    if (!project) throw new Error(`Project not found: ${key}`);
    const map = await get_project_map_by_key(key);
    const levels = get_levels_from_map(map);
    const level_names = get_level_names_from_map(map);
    return {
      ...project,
      levels,
      level_names
    } satisfies project_info_type;
  })();

  project_info_cache.set(key, promise);
  promise.catch(() => {
    if (project_info_cache.get(key) === promise) {
      project_info_cache.delete(key);
    }
  });
  return promise;
};

export const get_project_info_by_id = async (id: number): Promise<project_info_type> => {
  const project = await get_project_by_id(id);
  if (!project) throw new Error(`Project not found: ${id}`);
  return get_project_info_by_key(project.key);
};
