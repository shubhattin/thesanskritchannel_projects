import { z } from 'zod';
import {
  user_project_join,
  user_project_language_join,
  translations,
  texts,
  media_attachment,
  other,
  site_lekhas,
  projects
} from './schema';
import { createSelectSchema } from 'drizzle-zod';
import { recursive_list_schema } from '../state/data_types';

export const UserProjectJoinSchemaZod = createSelectSchema(user_project_join);
export const UserProjectLanguageJoinSchemaZod = createSelectSchema(user_project_language_join);

export const TranslationSchemaZod = createSelectSchema(translations);
export const TextSchemaZod = createSelectSchema(texts);
export const OtherSchemaZod = createSelectSchema(other);
export const MediaAttachmentSchemaZod = createSelectSchema(media_attachment, {
  link: z.string().url()
});

export const SiteLekhaSchemaZod = createSelectSchema(site_lekhas, {
  published_at: z.coerce.date().optional().nullable(),
  updated_at: z.coerce.date().optional().nullable()
});

export type SiteLekha = z.infer<typeof SiteLekhaSchemaZod>;
export type Project = z.infer<typeof ProjectSchemaZod>;

export const ProjectSchemaZod = createSelectSchema(projects, {
  map: recursive_list_schema,
  updated_at: z.coerce.date().optional().nullable(),
  created_at: z.coerce.date()
});
