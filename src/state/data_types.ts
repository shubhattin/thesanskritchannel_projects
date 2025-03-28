import { z } from 'zod';

const type_1_map_schema = z.object({
  name_dev: z.string().describe('Name in Devanagari'),
  name_nor: z.string().describe('Name in English'),
  pos: z.number().int().describe('Position starting from 1'),
  shloka_count: z.number().int(),
  shloka_count_expected: z.number().int().optional().describe('Expected Shloka Count'),
  total: z.number().int()
});
export type type_1_map_type = z.infer<typeof type_1_map_schema>;

const type_2_map_schema = type_1_map_schema.array();
export type tyoe_2_map_type = z.infer<typeof type_2_map_schema>;

export const type_3_map_schema = z
  .object({
    name_dev: z.string().describe('Name in Devanagari'),
    name_nor: z.string().describe('Name in English'),
    pos: z.number().int().describe('Position Starting from 1'),
    list_count: z.number().int(),
    list: type_2_map_schema,
    list_count_expected: z.number().int().optional().describe('Expected List Count')
  })
  .array();
export type type_3_map_type = z.infer<typeof type_3_map_schema>;

const shloka_schema = z.object({
  text: z.string().describe('Shloka Text'),
  index: z.number().int().describe('Index starting from 0'),
  shloka_num: z.string().nullable().optional().describe('Shloka Number')
});
const shloka_list_schema = shloka_schema.array();
export type shloka_list_type = z.infer<typeof shloka_list_schema>;
