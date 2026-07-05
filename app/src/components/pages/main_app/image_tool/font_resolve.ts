import {
  resolve_bundled_font_family,
  type ImageFontConfig,
  type NumberFontConfig
} from './settings';
import { FONT_FAMILY_NAME, is_bundled_font_key, type fonts_type } from '~/tools/font_tools';
import { is_system_font_family_available } from './system_fonts';

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

export function resolve_number_font_families(
  number_config: NumberFontConfig,
  main_config: ImageFontConfig,
  _norm_config: ImageFontConfig,
  system_overrides: {
    main: string | null;
    num_main: string | null;
    num_norm: string | null;
  },
  installed_families: string[] | null = null
): { main: string; norm: string } {
  if (!number_config.use_custom) {
    return {
      main: resolve_effective_font_family(
        main_config,
        system_overrides.main,
        installed_families
      ),
      norm:
        system_overrides.num_norm &&
        is_system_font_family_available(system_overrides.num_norm, installed_families)
          ? system_overrides.num_norm
          : FONT_FAMILY_NAME.ROBOTO
    };
  }

  const main_key = is_bundled_font_key(number_config.main_key)
    ? number_config.main_key
    : main_config.key;
  const norm_key = is_bundled_font_key(number_config.norm_key) ? number_config.norm_key : 'ROBOTO';

  return {
    main: resolve_effective_font_family(
      { key: main_key, family: number_config.main_family },
      system_overrides.num_main,
      installed_families
    ),
    norm: resolve_effective_font_family(
      { key: norm_key, family: number_config.norm_family },
      system_overrides.num_norm,
      installed_families
    )
  };
}

export function collect_font_load_keys(
  configs: { key: string; weight: 'normal' | 'bold' }[]
): { family: string; weight: 'normal' | 'bold' }[] {
  const seen = new Set<string>();
  const result: { family: string; weight: 'normal' | 'bold' }[] = [];

  for (const { key, weight } of configs) {
    if (!is_bundled_font_key(key)) continue;
    const family = FONT_FAMILY_NAME[key as fonts_type];
    const id = `${family}:${weight}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ family, weight });
  }

  return result;
}
