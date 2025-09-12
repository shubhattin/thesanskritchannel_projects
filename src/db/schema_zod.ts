import { z } from 'zod';
import {
  user,
  account,
  user_project_join,
  user_project_language_join,
  verification,
  translation,
  media_attachment,
  other,
  user_app_scope_join
} from './schema';
import { createSelectSchema } from 'drizzle-zod';

export const UserSchemaZod = createSelectSchema(user, {
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  banExpires: z.coerce.date().nullable()
});
export const AccountSchemaZod = createSelectSchema(account, {
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  accessTokenExpiresAt: z.coerce.date().nullable(),
  refreshTokenExpiresAt: z.coerce.date().nullable()
});
export const VerificationSchemaZod = createSelectSchema(verification, {
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date()
});
export const UserAppScopeJoinSchemaZod = createSelectSchema(user_app_scope_join);

export const UserProjectJoinSchemaZod = createSelectSchema(user_project_join);
export const UserProjectLanguageJoinSchemaZod = createSelectSchema(user_project_language_join);

export const TranslationSchemaZod = createSelectSchema(translation);
export const OtherSchemaZod = createSelectSchema(other);
export const MediaAttachmentSchemaZod = createSelectSchema(media_attachment, {
  link: z.string().url()
});
