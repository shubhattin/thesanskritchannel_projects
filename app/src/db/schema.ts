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
  boolean
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

export const texts = pgTable(
  'texts',
  {
    project_id: integer()
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    path: text().notNull(),
    index: integer().notNull(),
    shloka_num: integer(),
    text: text().default('').notNull(),
    /** Used for search queries (trigram search) */
    text_search: text().default('').notNull()
  },
  ({ project_id, path, index }) => [
    primaryKey({
      columns: [project_id, path, index]
    })
  ]
);

export const translations = pgTable(
  'translations',
  {
    project_id: integer()
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    lang_id: integer().notNull(),
    path: text().notNull(),
    index: integer().notNull(),
    text: text().default('').notNull()
  },
  ({ project_id, lang_id, path, index }) => [
    primaryKey({
      columns: [project_id, lang_id, path, index]
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
    project_id: integer()
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    lang_id: integer().notNull(),
    path: text().notNull(),
    media_type: media_type_enum().notNull(),
    link: text().notNull(),
    name: text().notNull()
  },
  ({ project_id, path }) => [index().on(project_id, path)]
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
  texts: many(texts),
  translations: many(translations),
  media_attachment: many(media_attachment),
  users_join: many(user_project_join),
  user_language_join: many(user_project_language_join)
}));

export const textRelations = relations(texts, ({ one }) => ({
  project: one(projects, { fields: [texts.project_id], references: [projects.id] })
}));

export const translationRelations = relations(translations, ({ one }) => ({
  project: one(projects, { fields: [translations.project_id], references: [projects.id] })
}));

export const mediaAttachmentRelations = relations(media_attachment, ({ one }) => ({
  project: one(projects, { fields: [media_attachment.project_id], references: [projects.id] })
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
