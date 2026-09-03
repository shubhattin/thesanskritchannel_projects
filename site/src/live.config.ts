import { defineLiveCollection } from 'astro/content/config';
import { lekhaDbLiveLoader } from './loaders/lekha-db-live';

const lekha = defineLiveCollection({
  loader: lekhaDbLiveLoader()
});

export const collections = { lekha };
