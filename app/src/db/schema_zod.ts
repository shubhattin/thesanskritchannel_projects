import { z } from 'zod';
import {
  user_project_join,
  user_project_language_join,
  translations,
  texts,
  media_attachment,
  other,
  site_lekhas,
  site_lekha_redirects,
  projects,
  project_paths,
  project_redirects,
  image_assets,
  text_image_assets_join,
  ai_batches,
  ai_batch_responses,
  image_system_prompt_templates,
  agent_chats,
  agent_messages
} from './schema';
import { createSelectSchema } from 'drizzle-zod';
import { recursive_list_schema } from '../state/data_types';
import { agent_model_id_schema } from '~/agents/models';

export const UserProjectJoinSchemaZod = createSelectSchema(user_project_join);
export const UserProjectLanguageJoinSchemaZod = createSelectSchema(user_project_language_join);

export const TranslationSchemaZod = createSelectSchema(translations, {
  updated_at: z.coerce.date().optional().nullable()
});
export const TextSchemaZod = createSelectSchema(texts, {
  updated_at: z.coerce.date().optional().nullable()
});
export const OtherSchemaZod = createSelectSchema(other);
export const MediaAttachmentSchemaZod = createSelectSchema(media_attachment, {
  link: z.url(),
  updated_at: z.coerce.date().optional().nullable()
});
export const ProjectPathSchemaZod = createSelectSchema(project_paths, {
  updated_at: z.coerce.date().optional().nullable()
});
export const SiteLekhaSchemaZod = createSelectSchema(site_lekhas, {
  published_at: z.coerce.date().optional().nullable(),
  updated_at: z.coerce.date().optional().nullable(),
  created_at: z.coerce.date()
});

export type SiteLekha = z.infer<typeof SiteLekhaSchemaZod>;
export type Project = z.infer<typeof ProjectSchemaZod>;

export const SiteLekhaRedirectSchemaZod = createSelectSchema(site_lekha_redirects, {
  created_at: z.coerce.date()
});
export const ProjectRedirectSchemaZod = createSelectSchema(project_redirects, {
  created_at: z.coerce.date()
});

export const ProjectSchemaZod = createSelectSchema(projects, {
  map: recursive_list_schema,
  updated_at: z.coerce.date().optional().nullable(),
  created_at: z.coerce.date()
});

export const ImageAssetSchemaZod = createSelectSchema(image_assets, {
  created_at: z.coerce.date()
});
export const TextImageAssetsJoinSchemaZod = createSelectSchema(text_image_assets_join);
export const AiBatchesSchemaZod = createSelectSchema(ai_batches, {
  type: z.enum(['image', 'text', 'object'])
});
export const AiBatchResponsesSchemaZod = createSelectSchema(ai_batch_responses);
export const ImageSystemPromptTemplatesSchemaZod = createSelectSchema(
  image_system_prompt_templates,
  {
    created_at: z.coerce.date(),
    updated_at: z.coerce.date().optional().nullable()
  }
);
export const AgentChatsSchemaZod = createSelectSchema(agent_chats, {
  model: agent_model_id_schema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  stop_requested_at: z.coerce.date().optional().nullable()
});
export const AgentMessagesSchemaZod = createSelectSchema(agent_messages, {
  role: z.enum(['system', 'user', 'assistant']),
  created_at: z.coerce.date()
});
