import { defineLiveCollection } from 'astro/content/config';
import { lekhaJsonLiveLoader } from './loaders/lekha-json-live';
import { lekha_schema_zod } from './loaders/lekha-json-live';

const lekha = defineLiveCollection({
  loader: lekhaJsonLiveLoader(),
  schema: lekha_schema_zod
});

export const collections = { lekha };
