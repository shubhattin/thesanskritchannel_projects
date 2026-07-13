import {
  pgTable,
  text,
  integer,
  primaryKey,
  pgEnum,
  serial,
  index,
  jsonb,
  timestamp,
  boolean,
  unique,
  varchar,
  smallint
} from 'drizzle-orm/pg-core';
import type { recursive_list_type } from '~/state/data_types';
import { relations } from 'drizzle-orm';
import type { BatchMetadata } from '~/utils/types/ai_batch_metadata';

export const projects = pgTable('projects', {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  name: text().notNull(),
  /** Sanskrit name */
  name_dev: text().notNull(),
  description: text(),
  /** Project Map */
  map: jsonb().notNull().$type<recursive_list_type>(),
  listed: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).$onUpdate(() => new Date())
});

export const project_paths = pgTable(
  'project_paths',
  {
    id: serial().primaryKey(),
    project_id: integer()
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    /** path here is in descending order of hierarchy */
    path: text().notNull(),
    prev_path: text(),
    // optional field for internal uses, debugging and recovery
    updated_at: timestamp({ withTimezone: true }).$onUpdate(() => new Date())
  },
  (table) => [
    unique('project_paths_project_id_path_unique').on(table.project_id, table.path),
    index('project_paths_project_id_path_prefix_idx').on(
      table.project_id,
      table.path.op('text_ops')
    )
  ]
);

export const texts = pgTable(
  'texts',
  {
    project_path_id: integer()
      .notNull()
      .references(() => project_paths.id, { onDelete: 'cascade' }),
    index: integer().notNull(),
    shloka_num: integer(),
    text: text().default('').notNull(),
    /** Used for search queries (trigram search) */
    text_search: text().default('').notNull(),
    updated_at: timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    /** This facility will be used later on to associate an image with a shloka */
    image_id: integer().references(() => image_assets.id, { onDelete: 'set null' })
  },
  ({ project_path_id, index }) => [
    primaryKey({
      columns: [project_path_id, index]
    })
  ]
);

export const translations = pgTable(
  'translations',
  {
    project_path_id: integer()
      .notNull()
      .references(() => project_paths.id, { onDelete: 'cascade' }),
    lang_id: integer().notNull(),
    index: integer().notNull(),
    text: text().default('').notNull(),
    updated_at: timestamp({ withTimezone: true }).$onUpdate(() => new Date())
  },
  ({ project_path_id, lang_id, index }) => [
    primaryKey({
      columns: [project_path_id, lang_id, index]
    })
  ]
);

/** other unstructured data and values */
export const other = pgTable('other', {
  key: text().notNull().primaryKey(),
  value: jsonb().notNull()
});

export const MEDIA_TYPE_LIST = ['pdf', 'text', 'video', 'audio'] as const;
export type media_list_type = (typeof MEDIA_TYPE_LIST)[number];
export const media_type_enum = pgEnum('media_type_enum', MEDIA_TYPE_LIST);
export const media_attachment = pgTable(
  'media_attachment',
  {
    id: serial().primaryKey(),
    project_path_id: integer()
      .notNull()
      .references(() => project_paths.id, { onDelete: 'cascade' }),
    lang_id: integer(),
    order: integer().notNull(),
    // lang_id of the resource (null if not specific)
    media_type: media_type_enum().notNull(),
    link: text().notNull(),
    name: text().notNull(),
    updated_at: timestamp({ withTimezone: true }).$onUpdate(() => new Date())
  },
  ({ project_path_id }) => [index().on(project_path_id)]
);

export const site_lekhas = pgTable(
  'site_lekhas',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    tags: text('tags').array().notNull().default([]),
    url_slug: text('url_slug').notNull().unique(),
    /** Markdown content */
    content: text('content').notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    published_at: timestamp('published_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
    draft: boolean('draft').notNull().default(true),
    /** listed on site */
    listed: boolean('listed').notNull().default(true),
    /** search index, indexed by search engine */
    search_indexed: boolean('search_indexed').notNull().default(true)
  },
  (table) => [index().on(table.published_at)]
);

export const image_assets = pgTable(
  'image_assets',
  {
    id: serial().primaryKey(),
    description: varchar('description', { length: 150 }),
    width: smallint().notNull(),
    height: smallint().notNull(),
    s3_key: text().notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [unique('image_assets_s3_key_unique').on(table.s3_key)]
);

/** One OpenAI Batch API job — shared fields for all custom_id responses in the batch. */
export const ai_batches = pgTable('ai_batches', {
  /** id returned by the Batch API */
  batch_id: text().primaryKey(),
  type: text().notNull().$type<'image' | 'text' | 'object'>(),
  /** whether OpenAI batch output has been fetched and applied to all response rows */
  output_resolved: boolean().notNull().default(false),
  /** Uploaded id for openai batch file input */
  input_file_id: text().notNull(),
  /** Uploaded id for openai batch file output (null until resolved) */
  output_file_id: text()
});

/** Per custom_id response / job within an OpenAI batch. */
export const ai_batch_responses = pgTable(
  'ai_batch_responses',
  {
    batch_id: text()
      .notNull()
      .references(() => ai_batches.batch_id, { onDelete: 'cascade' }),
    custom_id: text().notNull(),
    /** if the resource should be auto added to the main database */
    auto_approved: boolean().notNull().default(false),
    /** Extra info to store for future reference */
    metadata: jsonb().notNull().$type<BatchMetadata>()
  },
  (table) => [primaryKey({ columns: [table.batch_id, table.custom_id] })]
);

// join tables

/**
 * Used to group images under project_id+path+index/shloka
 */
export const text_image_assets_join = pgTable(
  'text_image_assets_join',
  {
    id: serial().primaryKey(),
    project_path_id: integer()
      .notNull()
      .references(() => project_paths.id, { onDelete: 'cascade' }),
    /** Index is nullable here as if the shloka at that index has been deleted then the image can still belong
     * to the project path
     */
    index: integer(),
    image_asset_id: integer()
      .notNull()
      .references(() => image_assets.id, { onDelete: 'cascade' })
  },
  (table) => [
    unique('text_image_assets_join_image_asset_id_unique').on(table.image_asset_id),
    index('text_image_assets_join_project_path_id_index_idx').on(table.project_path_id, table.index)
  ]
);

export const user_project_join = pgTable(
  'user_project_join',
  {
    user_id: text().notNull(),
    project_id: integer()
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' })
  },
  (table) => [primaryKey({ columns: [table.user_id, table.project_id] })]
);

export const user_project_language_join = pgTable(
  'user_project_language_join',
  {
    user_id: text().notNull(),
    project_id: integer()
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    language_id: integer().notNull()
  },
  (table) => [primaryKey({ columns: [table.user_id, table.project_id, table.language_id] })]
);

// relations

export const projectRelations = relations(projects, ({ many }) => ({
  project_paths: many(project_paths),
  users_join: many(user_project_join),
  user_language_join: many(user_project_language_join)
}));

export const projectPathRelations = relations(project_paths, ({ many, one }) => ({
  project: one(projects, {
    fields: [project_paths.project_id],
    references: [projects.id]
  }),
  texts: many(texts),
  translations: many(translations),
  media_attachment: many(media_attachment),
  text_image_assets: many(text_image_assets_join)
}));

export const textRelations = relations(texts, ({ one }) => ({
  project_path: one(project_paths, {
    fields: [texts.project_path_id],
    references: [project_paths.id]
  }),
  image_asset: one(image_assets, {
    fields: [texts.image_id],
    references: [image_assets.id]
  })
}));

export const imageAssetRelations = relations(image_assets, ({ many }) => ({
  texts: many(texts),
  text_image_joins: many(text_image_assets_join)
}));

export const textImageAssetsJoinRelations = relations(text_image_assets_join, ({ one }) => ({
  project_path: one(project_paths, {
    fields: [text_image_assets_join.project_path_id],
    references: [project_paths.id]
  }),
  image_asset: one(image_assets, {
    fields: [text_image_assets_join.image_asset_id],
    references: [image_assets.id]
  })
}));

export const translationRelations = relations(translations, ({ one }) => ({
  project_path: one(project_paths, {
    fields: [translations.project_path_id],
    references: [project_paths.id]
  })
}));

export const mediaAttachmentRelations = relations(media_attachment, ({ one }) => ({
  project_path: one(project_paths, {
    fields: [media_attachment.project_path_id],
    references: [project_paths.id]
  })
}));

export const userProjectJoinRelations = relations(user_project_join, ({ one }) => ({
  project: one(projects, { fields: [user_project_join.project_id], references: [projects.id] })
}));

export const userProjectLanguageJoinRelations = relations(
  user_project_language_join,
  ({ one }) => ({
    project: one(projects, {
      fields: [user_project_language_join.project_id],
      references: [projects.id]
    })
  })
);

export const ai_batchesRelations = relations(ai_batches, ({ many }) => ({
  responses: many(ai_batch_responses)
}));

export const ai_batch_responsesRelations = relations(ai_batch_responses, ({ one }) => ({
  batch: one(ai_batches, {
    fields: [ai_batch_responses.batch_id],
    references: [ai_batches.batch_id]
  })
}));
