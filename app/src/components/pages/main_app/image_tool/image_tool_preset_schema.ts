/**
 * As this data is also stored in db as jsonb so chnaging the same should always
 * be a incremental chnage so old schemas dont become invalid to parse
 */

import { z } from 'zod';
import { LANG_LIST, SCRIPT_LIST } from '~/state/lang_list';
import { FONT_FAMILY_NAME } from '~/tools/font_tools';

export const IMAGE_TOOL_PRESET_DB_PREFIX = 'image_tool_preset:';

export const BUILTIN_IMAGE_TOOL_PRESET_ID = '__builtin_default__';
export const BUILTIN_IMAGE_TOOL_PRESET_NAME = 'Default';

const MAIN_SCRIPT_KEYS = SCRIPT_LIST.filter((s) => s !== 'Normal') as [string, ...string[]];

export const to_db_key = (name: string) => `${IMAGE_TOOL_PRESET_DB_PREFIX}${name}`;

export const from_db_key = (key: string) => key.slice(IMAGE_TOOL_PRESET_DB_PREFIX.length);

export const is_image_tool_preset_db_key = (key: string) =>
  key.startsWith(IMAGE_TOOL_PRESET_DB_PREFIX);

export const is_reserved_image_tool_preset_name = (name: string) =>
  name === BUILTIN_IMAGE_TOOL_PRESET_ID ||
  name === BUILTIN_IMAGE_TOOL_PRESET_NAME ||
  name.trim() === '';

const bounding_coords_schema = z.object({
  left: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number()
});

const shloka_type_config_schema = z.object({
  bounding_coords: bounding_coords_schema,
  main_text_font_size: z.number(),
  norm_text_font_size: z.number(),
  trans_text_font_size: z.number(),
  reference_lines: z.object({
    top: z.number(),
    spacing: z.number()
  })
});

const shloka_configs_schema = z.object({
  '1': shloka_type_config_schema,
  '2': shloka_type_config_schema,
  '3': shloka_type_config_schema,
  '4': shloka_type_config_schema,
  '5': shloka_type_config_schema
});

const image_text_render_colors_schema = z.object({
  main: z.string(),
  normal: z.string(),
  number: z.string(),
  translation: z.string()
});

const image_font_config_schema = z.object({
  family: z.string(),
  key: z.string(),
  size: z.number(),
  new_line_spacing: z.number(),
  space_between_main_and_normal: z.number(),
  // optional + default: older rows may omit these keys
  text_for_min_height: z.string().nullable().optional().default(null),
  font_overridden: z.boolean().optional().default(false),
  font_weight: z.number().int().min(100).max(900).optional(),
  font_italic: z.boolean().optional().default(false)
});

/** Default number-font block for presets missing the key entirely (pre-font-picker rows). */
export const DEFAULT_NUMBER_FONT_PRESET = {
  use_custom: false,
  main_key: 'ADOBE_DEVANAGARI',
  main_family: FONT_FAMILY_NAME.ADOBE_DEVANAGARI,
  norm_key: 'ROBOTO',
  norm_family: FONT_FAMILY_NAME.ROBOTO,
  main_weight: 700,
  norm_weight: 700
} as const;

const number_font_config_schema = z.object({
  use_custom: z.boolean().optional().default(false),
  main_key: z.string().optional().default(DEFAULT_NUMBER_FONT_PRESET.main_key),
  main_family: z.string().optional().default(DEFAULT_NUMBER_FONT_PRESET.main_family),
  norm_key: z.string().optional().default(DEFAULT_NUMBER_FONT_PRESET.norm_key),
  norm_family: z.string().optional().default(DEFAULT_NUMBER_FONT_PRESET.norm_family),
  main_weight: z
    .number()
    .int()
    .min(100)
    .max(900)
    .optional()
    .default(DEFAULT_NUMBER_FONT_PRESET.main_weight),
  norm_weight: z
    .number()
    .int()
    .min(100)
    .max(900)
    .optional()
    .default(DEFAULT_NUMBER_FONT_PRESET.norm_weight)
});

/** Saved system font family names per text role (null = use project/bundled font). */
export const DEFAULT_SYSTEM_FONT_PRESET = {
  main: null,
  normal: null,
  trans: null,
  num_main: null,
  num_norm: null
} as const;

const system_font_overrides_schema = z.object({
  main: z.string().nullable().optional().default(null),
  normal: z.string().nullable().optional().default(null),
  trans: z.string().nullable().optional().default(null),
  num_main: z.string().nullable().optional().default(null),
  num_norm: z.string().nullable().optional().default(null)
});

const main_script_enum = z.enum(MAIN_SCRIPT_KEYS);
const lang_enum = z.enum(LANG_LIST as [string, ...string[]]);

export const image_tool_preset_config_schema = z.object({
  space_above_reference_line: z.number(),
  show_image_on_top_right: z.boolean(),
  shaded_background_image_status: z.boolean(),
  shloka_configs: shloka_configs_schema,
  translation_bounding_coords: bounding_coords_schema,
  image_render_colors: image_text_render_colors_schema,
  main_text_font_configs: z.record(main_script_enum, image_font_config_schema),
  normal_text_font_config: image_font_config_schema,
  trans_text_font_configs: z.record(lang_enum, image_font_config_schema),
  number_font_config: number_font_config_schema.default({ ...DEFAULT_NUMBER_FONT_PRESET }),
  system_font_overrides: system_font_overrides_schema.default({ ...DEFAULT_SYSTEM_FONT_PRESET })
});

export type ImageToolPresetConfig = z.infer<typeof image_tool_preset_config_schema>;

export type ImageToolPresetListItem = {
  name: string;
  config: ImageToolPresetConfig;
};
