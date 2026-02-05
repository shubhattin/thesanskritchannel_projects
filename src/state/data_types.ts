import { z } from 'zod';

export const type_1_map_schema = z.object({
  name_dev: z.string().describe('Name in Devanagari'),
  name_nor: z.string().describe('Name in English'),
  pos: z.int().describe('Position starting from 1'),
  shloka_count: z.int(),
  shloka_count_expected: z.int().optional().describe('Expected Shloka Count'),
  total: z.int()
});
export type type_1_map_type = z.infer<typeof type_1_map_schema>;

export const type_2_map_schema = type_1_map_schema.array();
export type tyoe_2_map_type = z.infer<typeof type_2_map_schema>;

export const type_3_map_schema = z
  .object({
    name_dev: z.string().describe('Name in Devanagari'),
    name_nor: z.string().describe('Name in English'),
    pos: z.int().describe('Position Starting from 1'),
    list_count: z.int(),
    list: type_2_map_schema,
    list_count_expected: z.int().optional().describe('Expected List Count')
  })
  .array();
export type type_3_map_type = z.infer<typeof type_3_map_schema>;

export const type_4_map_schema = z
  .object({
    name_dev: z.string().describe('Name in Devanagari'),
    name_nor: z.string().describe('Name in English'),
    pos: z.int().describe('Position Starting from 1'),
    list_count: z.int(),
    list: type_3_map_schema,
    list_count_expected: z.int().optional().describe('Expected List Count')
  })
  .array();
export type type_4_map_type = z.infer<typeof type_4_map_schema>;

export const type_5_map_schema = z
  .object({
    name_dev: z.string().describe('Name in Devanagari'),
    name_nor: z.string().describe('Name in English'),
    pos: z.int().describe('Position Starting from 1'),
    list: type_4_map_schema,
    list_count_expected: z.int().optional().describe('Expected List Count')
  })
  .array();
export type type_5_map_type = z.infer<typeof type_5_map_schema>;

export const shloka_schema = z.object({
  text: z.string().describe('Shloka Text'),
  index: z.int().describe('Index starting from 0'),
  shloka_num: z.number().nullable().describe('Shloka Number')
});
export const shloka_list_schema = shloka_schema.array();
export type shloka_list_type = z.infer<typeof shloka_list_schema>;

export const CURRENT_APP_SCOPE = 'projects_portal' as const;
