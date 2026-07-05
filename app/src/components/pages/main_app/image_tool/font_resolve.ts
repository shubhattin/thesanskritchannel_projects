import { resolve_bundled_font_family, type ImageFontConfig } from './settings';
import { FONT_FAMILY_NAME, is_bundled_font_key, type fonts_type } from '~/tools/font_tools';
import { is_system_font_family_available } from './system_fonts';
import {
  default_main_font_weight,
  default_normal_font_weight,
  resolve_konva_font_style,
  weight_to_font_api
} from './image_font_weight';

export function resolve_effective_font_family(
  config: Pick<ImageFontConfig, 'key' | 'family'>,
  system_family: string | null | undefined,
  installed_families: string[] | null = null
): string {
  if (system_family) {
    if (!is_system_font_family_available(system_family, installed_families)) {
      return resolve_bundled_font_family(config);
    }
    return system_family;
  }
  return resolve_bundled_font_family(config);
}

/** Shloka number indicators follow main (native) and normal (romanized) text fonts. */
export function resolve_number_font_families(
  main_config: ImageFontConfig,
  norm_config: ImageFontConfig,
  system_overrides: { main: string | null; normal: string | null },
  installed_families: string[] | null = null
): { main: string; norm: string } {
  return {
    main: resolve_effective_font_family(main_config, system_overrides.main, installed_families),
    norm: resolve_effective_font_family(norm_config, system_overrides.normal, installed_families)
  };
}

export function collect_font_load_keys(
  configs: { key: string; weight: number; italic?: boolean }[]
): { family: string; weight: number | 'normal' | 'bold'; italic?: boolean }[] {
  const seen = new Set<string>();
  const result: { family: string; weight: number | 'normal' | 'bold'; italic?: boolean }[] = [];

  for (const { key, weight, italic = false } of configs) {
    if (!is_bundled_font_key(key)) continue;
    const font_key = key as fonts_type;
    const family = FONT_FAMILY_NAME[font_key];
    const resolved_weight = weight_to_font_api(font_key, weight);
    const id = `${family}:${resolved_weight}:${italic ? 'i' : 'n'}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ family, weight: resolved_weight, italic });
  }

  return result;
}

export function resolve_number_font_styles(
  main_config: ImageFontConfig,
  norm_config: ImageFontConfig
): { main: string; norm: string } {
  return {
    main: resolve_konva_font_style(main_config, default_main_font_weight()),
    norm: resolve_konva_font_style(norm_config, default_normal_font_weight())
  };
}
