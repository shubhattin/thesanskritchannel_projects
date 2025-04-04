import { relations } from 'drizzle-orm';
import { account, user } from './auth-schema';
import { pgTable, text, integer, primaryKey, pgEnum, serial } from 'drizzle-orm/pg-core';
export * from './auth-schema';

export const translation = pgTable(
  'translation',
  {
    project_id: integer().notNull(),
    lang_id: integer().notNull(),
    second: integer().notNull(),
    first: integer().notNull(),
    index: integer().notNull(),
    text: text().default('').notNull()
  },
  ({ project_id, lang_id, second, first, index }) => [
    primaryKey({
      columns: [project_id, lang_id, second, first, index]
      // caannot have first and second as primary keys if they are null
      // so to indicate absense `0` will be used instead on NULL
    })
  ]
);

export const media_type_enum = pgEnum('media_type_enum', ['pdf', 'text', 'video', 'audio']);
export const media_attachment = pgTable('media_attachment', {
  id: serial().primaryKey(),
  project_id: integer().notNull(),
  lang_id: integer().notNull(),
  second: integer().notNull(),
  first: integer().notNull(),
  type: media_type_enum().notNull(),
  link: text().notNull()
});

/*
first, second and such are in reverse order to facilitate addition of more layers at the top instead of bottom
first is foe lower, second is higher level of classification
Like for Ramayana, first is sarga, second is kanda
*/

// join tables

export const user_project_join = pgTable(
  'user_project_join',
  {
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    project_id: integer().notNull()
  },
  (table) => [primaryKey({ columns: [table.user_id, table.project_id] })]
);

export const user_project_language_join = pgTable(
  'user_project_language_join',
  {
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    project_id: integer().notNull(),
    language_id: integer().notNull()
  },
  (table) => [primaryKey({ columns: [table.user_id, table.project_id, table.language_id] })]
);

// relations

export const userRelation = relations(user, ({ one, many }) => ({
  accounts: many(account),
  projects: many(user_project_join)
}));

export const accountRelation = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] })
}));

export const userProjectJoinRelation = relations(user_project_join, ({ one }) => ({
  user: one(user, { fields: [user_project_join.user_id], references: [user.id] })
}));

export const userProjectLanguageJoinRelation = relations(user_project_language_join, ({ one }) => ({
  user: one(user, { fields: [user_project_language_join.user_id], references: [user.id] })
}));
