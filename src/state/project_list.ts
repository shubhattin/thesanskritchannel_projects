import { z } from 'zod';
import type { tyoe_2_map_type, type_1_map_type, type_3_map_type } from './data_types';

const PROJECT_KEYS = ['ramayanam', 'bhagavadgita', 'narayaneeyam', 'shivatandava'] as const;
export const project_keys_enum_schema = z.enum(PROJECT_KEYS);
export type project_keys_type = z.infer<typeof project_keys_enum_schema>;

type project_type = {
  id: number;
  name: string;
  name_dev: string;
  description?: string;
  key: project_keys_type;
};

// ALWAYS BE CAREFUL BEFORE CHANGING THIS LIST
// AS CHNAGE IN PRE-EXISTING PROJECT IDS WOULD CAUSE DATA MISMATCHs

export const PROJECT_LIST: project_type[] = [
  {
    id: 1,
    name: 'Valmiki Ramayanam',
    name_dev: 'श्रीमद्रामायणम्',
    key: 'ramayanam'
  },
  {
    id: 2,
    name: 'Bhagavad Gita',
    name_dev: 'श्रीमद्भगवद्गीता',
    key: 'bhagavadgita'
  },
  {
    id: 3,
    name: 'Narayaneeyam',
    name_dev: 'नारायणीयम्',
    key: 'narayaneeyam'
  },
  {
    id: 4,
    name: 'Shiva Tandava Stotra',
    name_dev: 'शिवताण्डवस्तोत्रम्',
    key: 'shivatandava'
  }
];

export const get_project_from_id = (id: number) => {
  return PROJECT_LIST[id - 1];
};

export const get_project_from_key = (key: project_keys_type) => {
  return PROJECT_LIST[PROJECT_KEYS.indexOf(key)];
};

export type extendted_map_type =
  | {
      levels: 1;
      map_info: () => Promise<type_1_map_type>;
    }
  | {
      levels: 2;
      map_info: () => Promise<tyoe_2_map_type>;
    }
  | {
      levels: 3;
      map_info: () => Promise<type_3_map_type>;
    };

export const get_map_type = <T extends extendted_map_type['levels']>(
  map_info: Awaited<ReturnType<extendted_map_type['map_info']>>,
  levels: T
): T extends 1
  ? type_1_map_type
  : T extends 2
    ? tyoe_2_map_type
    : T extends 3
      ? type_3_map_type
      : never => {
  return map_info as any;
};

type project_info_type = {
  key: project_keys_type;
  /** The project level here also includes shloka */
  level_names: string[];
} & extendted_map_type;

export const PROJECT_INFO: project_info_type[] = [
  {
    key: 'ramayanam',
    levels: 3,
    level_names: ['Shloka', 'Sarga', 'Kanda'],
    map_info: async () => (await import('@data/ramayanam/ramayanam_map.json')).default
  },
  {
    key: 'bhagavadgita',
    levels: 2,
    level_names: ['Shloka', 'Chapter'],
    map_info: async () => (await import('@data/bhagavadgita/bhagavadgita_map.json')).default
  },
  {
    key: 'narayaneeyam',
    levels: 2,
    level_names: ['Shloka', 'Dashaka'],
    map_info: async () => (await import('@data/narayaneeyam/narayaneeyam_map.json')).default
  },
  {
    key: 'shivatandava',
    levels: 1,
    level_names: ['Shloka'],
    map_info: async () => (await import('@data/shivatandava/shivatandava_map.json')).default
  }
];

export const get_project_info_from_key = (key: project_keys_type) => {
  return PROJECT_INFO[PROJECT_KEYS.indexOf(key)];
};

export const get_project_info_from_id = (id: number) => {
  const project = PROJECT_LIST[id - 1];
  return get_project_info_from_key(project.key);
};
