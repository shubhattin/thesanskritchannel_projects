import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const lekha = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lekha' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().optional()
  })
});

export const collections = { lekha };
