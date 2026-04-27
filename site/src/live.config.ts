import { defineLiveCollection } from 'astro/content/config';
import { lekhaDbLiveLoader, lekha_schema_zod } from './loaders/lekha-db-live';

const lekha = defineLiveCollection({
  loader: lekhaDbLiveLoader(),
  schema: lekha_schema_zod
});

export const collections = { lekha };
