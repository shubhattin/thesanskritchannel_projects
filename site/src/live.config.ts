import { defineLiveCollection } from 'astro/content/config';
import { lekhaDbLiveLoader } from './loaders/lekha-db-live';
import { SiteLekhaSchemaZod } from '$app/db/schema_zod';

const lekha = defineLiveCollection({
  loader: lekhaDbLiveLoader(),
  schema: SiteLekhaSchemaZod.omit({ content: true, id: true })
});

export const collections = { lekha };
