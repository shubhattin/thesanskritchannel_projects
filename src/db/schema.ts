import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  primaryKey,
  pgEnum,
  serial,
  index,
  jsonb
} from 'drizzle-orm/pg-core';

export const texts = pgTable(
  'texts',
  {
    project_id: integer().notNull(),
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

export const translations = pgTable(
  'translations',
  {
    project_id: integer().notNull(),
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
    project_id: integer().notNull(),
    lang_id: integer().notNull(),
    path: text().notNull(),
    media_type: media_type_enum().notNull(),
    link: text().notNull(),
    name: text().notNull()
  },
  ({ project_id, path }) => [index('media_link_index').on(project_id, path)]
);

// join tables

export const user_project_join = pgTable(
  'user_project_join',
  {
    user_id: text().notNull(),
    project_id: integer().notNull()
  },
  (table) => [primaryKey({ columns: [table.user_id, table.project_id] })]
);

export const user_project_language_join = pgTable(
  'user_project_language_join',
  {
    user_id: text().notNull(),
    project_id: integer().notNull(),
    language_id: integer().notNull()
  },
  (table) => [primaryKey({ columns: [table.user_id, table.project_id, table.language_id] })]
);

// relations
