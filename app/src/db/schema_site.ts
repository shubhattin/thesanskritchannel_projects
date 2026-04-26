/**
 * Site schema
 * 
 * This is declared as the db instance will shared by both `app/` and `site/` 
 * It also allows to share a single migration flow for db
 */

import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  index
} from 'drizzle-orm/pg-core';

export const site_lekhas = pgTable('site_lekhas', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  tags: text('tags').array().notNull().default([]),
  /** Markdown content */
  content: text('content').notNull(),
  published_at: timestamp('published_at', { withTimezone: true }).notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull(),
  draft: boolean('draft').notNull().default(true),
  /** listed on site */
  listed: boolean('listed').notNull().default(true),
  /** search index, indexed by search engine */
  search_indexed: boolean('search_indexed').notNull().default(false),
}, (table) => [
  index('published_at_idx').on(table.published_at),
]);
