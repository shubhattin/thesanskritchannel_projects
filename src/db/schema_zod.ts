import { z } from 'zod';
import {
  user_project_join,
  user_project_language_join,
  translation,
  media_attachment,
  other
} from './schema';
import { createSelectSchema } from 'drizzle-zod';

export const UserProjectJoinSchemaZod = createSelectSchema(user_project_join);
export const UserProjectLanguageJoinSchemaZod = createSelectSchema(user_project_language_join);

export const TranslationSchemaZod = createSelectSchema(translation);
export const OtherSchemaZod = createSelectSchema(other);
export const MediaAttachmentSchemaZod = createSelectSchema(media_attachment, {
  link: z.string().url()
});
