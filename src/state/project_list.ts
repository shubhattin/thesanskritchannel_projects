import { z } from 'zod';
import type { recursive_list_type } from './data_types';

const PROJECT_KEYS = [
  'ramayanam',
  'bhagavadgita',
  'narayaneeyam',
  'shivatandavastotram',
  'saundaryalahari',
  'rgveda'
] as const;
export const project_keys_enum_schema = z.enum(PROJECT_KEYS);
export type project_keys_type = z.infer<typeof project_keys_enum_schema>;

type project_type = {
  id: number;
  name: string;
  name_dev: string;
  description?: string;
  key: project_keys_type;
  get_map?: () => Promise<recursive_list_type>;
};

// ALWAYS BE CAREFUL BEFORE CHANGING THIS LIST
// AS CHANGE IN PRE-EXISTING PROJECT IDS WOULD CAUSE DATA MISMATCHs

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
    key: 'shivatandavastotram',
    get_map: async () =>
      (await import('@data/4. shivatandavastotram/shivatandavastotram_map.json'))
        .default as recursive_list_type
  },
  {
    id: 5,
    name: 'Saundarya Lahari',
    name_dev: 'सौन्दर्यलहरी',
    key: 'saundaryalahari',
    get_map: async () =>
      (await import('@data/5. saundaryalahari/saundaryalahari_map.json'))
        .default as recursive_list_type
  },
  {
    id: 6,
    name: 'Rgveda',
    name_dev: 'ऋग्वेद',
    key: 'rgveda'
  }
];

export const get_project_from_id = (id: number) => {
  return PROJECT_LIST[id - 1];
};

export const get_project_from_key = (key: project_keys_type) => {
  return PROJECT_LIST[PROJECT_KEYS.indexOf(key)];
};

export const get_path_params = (
  selected_text_levels: (number | null)[],
  project_levels: number
) => {
  return selected_text_levels.slice(0, project_levels - 1).reverse() as number[];
};

// export type extendted_map_type =
//   | {
//       levels: 1;
//       map_info: () => Promise<type_1_map_type>;
//     }
//   | {
//       levels: 2;
//       map_info: () => Promise<tyoe_2_map_type>;
//     }
//   | {
//       levels: 3;
//       map_info: () => Promise<type_3_map_type>;
//     }
//   | {
//       levels: 4;
//       map_info: () => Promise<type_4_map_type>;
//     }
//   | {
//       levels: 5;
//       map_info: () => Promise<type_5_map_type>;
//     };

// export const get_map_type = <T extends extendted_map_type['levels']>(
//   map_info: Awaited<ReturnType<extendted_map_type['map_info']>>,
//   levels: T
// ): T extends 1
//   ? type_1_map_type
//   : T extends 2
//     ? tyoe_2_map_type
//     : T extends 3
//       ? type_3_map_type
//       : T extends 4
//         ? type_4_map_type
//         : T extends 5
//           ? type_5_map_type
//           : never => {
//   return map_info as any;
// };
// type project_info_type = {
//   [K in project_keys_type]: {
//     // key: K;
//     /** The project level here also includes shloka */
//     level_names: string[];
//   } & extendted_map_type;
// };

// export const PROJECT_INFO: project_info_type = {
//   ramayanam: {
//     levels: 3,
//     level_names: ['Shloka', 'Sarga', 'Kanda'],
//     map_info: async () => (await import('@data/1. ramayanam/ramayanam_map.json')).default
//   },
//   bhagavadgita: {
//     levels: 2,
//     level_names: ['Shloka', 'Chapter'],
//     map_info: async () => (await import('@data/2. bhagavadgita/bhagavadgita_map.json')).default
//   },
//   narayaneeyam: {
//     levels: 2,
//     level_names: ['Shloka', 'Dashaka'],
//     map_info: async () => (await import('@data/3. narayaneeyam/narayaneeyam_map.json')).default
//   },
//   shivatandavastotram: {
//     levels: 1,
//     level_names: ['Shloka'],
//     map_info: async () =>
//       (await import('@data/4. shivatandavastotram/shivatandavastotram_map.json')).default
//   },
//   saundaryalahari: {
//     levels: 1,
//     level_names: ['Shloka'],
//     map_info: async () =>
//       (await import('@data/5. saundaryalahari/saundaryalahari_map.json')).default
//   },
//   rgveda: {
//     levels: 5,
//     level_names: ['Mantra', 'Sukta', 'Mandala', 'Bhaga', 'Shakha'],
//     map_info: async () => (await import('@data/6. rgveda/rgveda_map.json')).default
//   }
// };

// export const get_project_info_from_key = (key: project_keys_type) => {
//   return { ...PROJECT_INFO[key], key };
// };
//
// export const get_project_info_from_id = (id: number) => {
//   const project = PROJECT_LIST[id - 1];
//   return get_project_info_from_key(project.key);
// };
