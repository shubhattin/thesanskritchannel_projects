import { recursive_list_schema, type recursive_list_type } from '~/state/data_types';

type project_type_server = {
  id: number;
  name: string;
  name_dev: string;
  description?: string;
  key: string;
  get_map: () => Promise<recursive_list_type>;
};

export const _tmp_PROJECT_LIST: project_type_server[] = [
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
