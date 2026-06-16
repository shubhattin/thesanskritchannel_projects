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
  unique
} from 'drizzle-orm/pg-core';
import type { recursive_list_type } from '~/state/data_types';
import { relations } from 'drizzle-orm';

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
    updated_at: timestamp({ withTimezone: true }).$onUpdate(() => new Date())
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
// path here is in descending order of hierarchy

export const other = pgTable('other', {
  key: text().notNull().primaryKey(),
  value: jsonb().notNull()
});
// other unstructured data and values

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

// join tables

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
  media_attachment: many(media_attachment)
}));

export const textRelations = relations(texts, ({ one }) => ({
  project_path: one(project_paths, {
    fields: [texts.project_path_id],
    references: [project_paths.id]
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
