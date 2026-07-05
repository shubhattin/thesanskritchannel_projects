import { is_variable_bundled_font, type fonts_type } from '~/tools/font_tools';

export const REGULAR_FONT_WEIGHT = 400;
export const BOLD_FONT_WEIGHT = 700;

export type ImageFontWeightOption = typeof REGULAR_FONT_WEIGHT | typeof BOLD_FONT_WEIGHT;

export function is_bold_font_weight(weight: number): boolean {
  return weight >= 600;
}

export function default_main_font_weight(): number {
  // bold
  return 700;
}

export function default_normal_font_weight(): number {
  // regular
  return 400;
}

export function default_trans_font_weight(): number {
  // regular
  return 400;
}

export function default_number_font_weight(): number {
  // bold
  return 700;
}

export function resolve_font_weight(config: { font_weight?: number }, fallback: number): number {
  const w = config.font_weight;
  if (w === undefined || w === null) return fallback;
  return w;
}

export function resolve_font_italic(config: { font_italic?: boolean }): boolean {
  return config.font_italic ?? false;
}

/** Konva `fontStyle` weight part — canvas accepts numeric weights for variable fonts. */
export function weight_to_konva_font_style(weight: number): string {
  if (weight >= 700) return 'bold';
  if (weight <= 400) return 'normal';
  return String(weight);
}

/** Full Konva `fontStyle` combining weight and italic. */
export function to_konva_font_style(weight: number, italic: boolean): string {
  const weight_part = weight_to_konva_font_style(weight);
  if (!italic) return weight_part;
  if (weight_part === 'normal') return 'italic';
  if (weight_part === 'bold') return 'italic bold';
  return `italic ${weight_part}`;
}

export function resolve_konva_font_style(
  config: { font_weight?: number; font_italic?: boolean },
  weight_fallback: number
): string {
  return to_konva_font_style(
    resolve_font_weight(config, weight_fallback),
    resolve_font_italic(config)
  );
}

/** Weight passed to `document.fonts.load` for a bundled family. */
export function weight_to_font_api(
  font_key: fonts_type,
  weight: number
): number | 'normal' | 'bold' {
  if (is_variable_bundled_font(font_key)) return weight;
  if (weight >= 600) return 'bold';
  if (weight <= 450) return 'normal';
  return weight;
}
