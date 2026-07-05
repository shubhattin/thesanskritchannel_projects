import { get, writable } from 'svelte/store';
import { copy_plain_object } from '~/tools/kry';
import {
  DEFAULT_SHLOKA_CONFIG,
  DEFAULT_SHLOKA_CONFIG_SHARED,
  DEFAULT_TRANSLATION_BOUNDING_COORDS,
  DEFAULT_NUMBER_FONT_CONFIG,
  get_image_font_info,
  shloka_configs,
  SPACE_ABOVE_REFERENCE_LINE
} from './settings';
import {
  DEFAULT_IMAGE_TEXT_RENDER_COLORS,
  DEFAULT_MAIN_TEXT_FONT_CONFIGS,
  DEFAULT_TRANS_TEXT_FONT_CONFIGS,
  image_render_colors,
  main_text_font_configs,
  normal_text_font_config,
  number_font_config,
  reset_image_drag_positions,
  shaded_background_image_status,
  show_image_on_top_right,
  system_font_overrides,
  trans_text_font_configs,
  translation_bounding_coords
} from './image_state';
import {
  EMPTY_SYSTEM_FONT_OVERRIDES,
  sanitize_system_font_overrides,
  toast_missing_system_fonts
} from './system_fonts';
import {
  DEFAULT_SYSTEM_FONT_PRESET,
  image_tool_preset_config_schema,
  type ImageToolPresetConfig
} from './image_tool_preset_schema';
import type { shloka_number_type, NumberFontConfig } from './settings';

const shloka_configs_for_preset = (configs: Record<shloka_number_type, unknown>) => ({
  '1': configs[1],
  '2': configs[2],
  '3': configs[3],
  '4': configs[4],
  '5': configs[5]
});

const shloka_configs_from_preset = (
  configs: ImageToolPresetConfig['shloka_configs']
): Record<shloka_number_type, ImageToolPresetConfig['shloka_configs']['1']> => ({
  1: configs['1'],
  2: configs['2'],
  3: configs['3'],
  4: configs['4'],
  5: configs['5']
});

export function get_builtin_default_image_tool_preset(): ImageToolPresetConfig {
  return image_tool_preset_config_schema.parse({
    space_above_reference_line: DEFAULT_SHLOKA_CONFIG_SHARED.SPACE_ABOVE_REFERENCE_LINE,
    show_image_on_top_right: true,
    shaded_background_image_status: import.meta.env.DEV,
    shloka_configs: shloka_configs_for_preset(copy_plain_object(DEFAULT_SHLOKA_CONFIG)),
    translation_bounding_coords: copy_plain_object(DEFAULT_TRANSLATION_BOUNDING_COORDS),
    image_render_colors: copy_plain_object(DEFAULT_IMAGE_TEXT_RENDER_COLORS),
    main_text_font_configs: copy_plain_object(DEFAULT_MAIN_TEXT_FONT_CONFIGS),
    normal_text_font_config: copy_plain_object(get_image_font_info('Normal', 'shloka')),
    trans_text_font_configs: copy_plain_object(DEFAULT_TRANS_TEXT_FONT_CONFIGS),
    number_font_config: copy_plain_object(DEFAULT_NUMBER_FONT_CONFIG),
    system_font_overrides: copy_plain_object(DEFAULT_SYSTEM_FONT_PRESET)
  });
}

export function collect_image_tool_preset(): ImageToolPresetConfig {
  return image_tool_preset_config_schema.parse({
    space_above_reference_line: get(SPACE_ABOVE_REFERENCE_LINE),
    show_image_on_top_right: get(show_image_on_top_right),
    shaded_background_image_status: get(shaded_background_image_status),
    shloka_configs: shloka_configs_for_preset(get(shloka_configs)),
    translation_bounding_coords: get(translation_bounding_coords),
    image_render_colors: get(image_render_colors),
    main_text_font_configs: get(main_text_font_configs),
    normal_text_font_config: get(normal_text_font_config),
    trans_text_font_configs: get(trans_text_font_configs),
    number_font_config: get(number_font_config),
    system_font_overrides: get(system_font_overrides)
  });
}

export async function apply_image_tool_preset(
  config: ImageToolPresetConfig
): Promise<ImageToolPresetConfig> {
  const parsed = image_tool_preset_config_schema.parse(config);
  const { overrides: sanitized_system_fonts, missing } = await sanitize_system_font_overrides(
    copy_plain_object(parsed.system_font_overrides ?? EMPTY_SYSTEM_FONT_OVERRIDES)
  );
  // Legacy number-font system overrides are ignored; numbers follow main/normal fonts.
  const system_fonts = {
    ...sanitized_system_fonts,
    num_main: null,
    num_norm: null
  };
  SPACE_ABOVE_REFERENCE_LINE.set(parsed.space_above_reference_line);
  show_image_on_top_right.set(parsed.show_image_on_top_right);
  shaded_background_image_status.set(parsed.shaded_background_image_status);
  shloka_configs.set(copy_plain_object(shloka_configs_from_preset(parsed.shloka_configs)));
  translation_bounding_coords.set(copy_plain_object(parsed.translation_bounding_coords));
  image_render_colors.set(copy_plain_object(parsed.image_render_colors));
  main_text_font_configs.set(
    copy_plain_object(parsed.main_text_font_configs) as Parameters<
      typeof main_text_font_configs.set
    >[0]
  );
  normal_text_font_config.set(
    copy_plain_object(parsed.normal_text_font_config) as Parameters<
      typeof normal_text_font_config.set
    >[0]
  );
  trans_text_font_configs.set(
    copy_plain_object(parsed.trans_text_font_configs) as Parameters<
      typeof trans_text_font_configs.set
    >[0]
  );
  number_font_config.set(copy_plain_object(parsed.number_font_config) as NumberFontConfig);
  system_font_overrides.set(copy_plain_object(system_fonts));
  reset_image_drag_positions();

  toast_missing_system_fonts(missing);

  return {
    ...parsed,
    system_font_overrides: system_fonts
  };
}

export const loaded_preset_snapshot = writable<ImageToolPresetConfig>(
  get_builtin_default_image_tool_preset()
);

export async function reset_to_loaded_preset() {
  const applied = await apply_image_tool_preset(get(loaded_preset_snapshot));
  loaded_preset_snapshot.set(copy_plain_object(applied));
}

export function image_tool_presets_equal(a: ImageToolPresetConfig, b: ImageToolPresetConfig) {
  return JSON.stringify(copy_plain_object(a)) === JSON.stringify(copy_plain_object(b));
}
