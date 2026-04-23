import { defineLiveCollection } from 'astro/content/config';
import { lekhaJsonLiveLoader } from './loaders/lekha-json-live';
import { z } from 'astro/zod';

const lekha = defineLiveCollection({
  loader: lekhaJsonLiveLoader(),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z
      .preprocess(
        (v) => (v === null || v === '' ? void 0 : v),
        z.coerce.date().optional()
      ),
    draft: z.boolean().optional(),
    content: z.string().optional()
  })
});

export const collections = { lekha };
