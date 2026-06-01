import { z } from 'zod';

export const recursive_list_schema = z.object({
  name_dev: z.string().describe('Name in Devanagari'),
  // Every text map starts with a top level where `name_dev` is actually the name of the
  get list() {
    return recursive_list_schema.array();
  },
  info: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('shloka'), // this marks the lowest level and end of the recursive structure
      // shloka, mantra and others are used as the same thing to mean
      shloka_count: z.int(),
      total: z.int().describe('Total Number of text lines/padas/units'),
      // `shoka_count` and `total` have to be updated when `texts` for a path changes
      shloka_count_expected: z.int().optional().nullable().describe('Expected Shloka Count')
    }),
    z.object({
      type: z.literal('list'),
      /** Name of the list type, like Kanda, Sarga, Shloka, etc. (English) */
      list_name: z.string().describe('Level/ListType Name'),
      // ^ this level name is "Text" specific, like Shloka/Mantra, Sarga, Kanda, Chapter, Mandala, Sukta, etc.
      list_count_expected: z.int().optional().nullable().describe('Expected List Count')
    })
  ])
});
export type recursive_list_type = z.infer<typeof recursive_list_schema>;

export const shloka_schema = z.object({
  text: z.string().describe('Shloka Text'),
  index: z.int().describe('Index starting from 0'),
  shloka_num: z.number().nullable().describe('Shloka Number')
});
export const shloka_list_schema = shloka_schema.array();
export type shloka_list_type = z.infer<typeof shloka_list_schema>;

/** Identifier for projects portal (Texts Management) */
export const APP_SCOPE_ID_PROJECT_PORTAL = 'projects_portal' as const;
/** Identifier for Lekha Publishing and Management */
export const APP_SCOPE_ID_LEKHA = 'lekha' as const;

export const APP_SCOPE_IDENTIFIERS = {
  [APP_SCOPE_ID_PROJECT_PORTAL]: 'Projects Portal',
  [APP_SCOPE_ID_LEKHA]: 'Lekha'
};

export const APP_SCOPES_ENUM = z.enum([APP_SCOPE_ID_PROJECT_PORTAL, APP_SCOPE_ID_LEKHA]);
export type AppScopeEnum = z.infer<typeof APP_SCOPES_ENUM>;
