import { z } from 'zod';

export const recursive_list_schema = z.object({
  name_dev: z.string().describe('Name in Devanagari'),
  name_nor: z.string().describe('Name in English(normalized)'),
  // Every text map starts with a top level where `name_dev` is actually the name of the text
  pos: z.int().describe('Position starting from 1'),
  // ^ this level name is "Text" specific, like Shloka/Mantra, Sarga, Kanda, Chapter, Mandala, Sukta, etc.
  get list() {
    return recursive_list_schema.array();
  },
  info: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('shloka'), // this marks the lowest level and end of the recursive structure
      // shloka, mantra and others are used as the same thing to mean
      shloka_count: z.int(),
      total: z.int().describe('Total Number of text lines/padas/units'),
      shloka_count_expected: z.int().optional().nullable().describe('Expected Shloka Count')
    }),
    z.object({
      type: z.literal('list'),
      list_name: z.string().describe('Level/ListType Name'),
      list_count: z.int(),
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

export const CURRENT_APP_SCOPE = 'projects_portal' as const;
