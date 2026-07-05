import { FONT_FAMILY_NAME, type fonts_type } from '~/tools/font_tools';
import { weight_to_font_api } from './image_font_weight';

const loaded_fonts = new Set<string>();

type FontWeight = 'normal' | 'bold' | number;

type FontLoadRequest = {
  family: string;
  weight: FontWeight;
  italic?: boolean;
  font_key?: fonts_type;
};

function font_load_key(family: string, weight: FontWeight, italic = false): string {
  return `${family}:${weight}:${italic ? 'i' : 'n'}`;
}

function font_load_css(weight: FontWeight, italic: boolean, family: string): string {
  const style_prefix = italic ? 'italic ' : '';
  return `${style_prefix}${weight} 48px "${family}"`;
}

/**
 * Ensures the given font families are loaded via the browser's native font loading API.
 * Bundled fonts must already be declared via CSS `@font-face` rules (see `app.scss`).
 */
export async function ensure_fonts_loaded(families: FontLoadRequest[]): Promise<void> {
  const to_load = families.filter(
    (f) => !loaded_fonts.has(font_load_key(f.family, f.weight, f.italic))
  );
  if (to_load.length === 0) return;

  await Promise.all(
    to_load.map(async ({ family, weight, italic = false }) => {
      const key = font_load_key(family, weight, italic);
      try {
        await document.fonts.load(font_load_css(weight, italic, family));
        loaded_fonts.add(key);
      } catch {
        console.warn(`[font_loader] Could not load font: ${key}`);
      }
    })
  );
  await document.fonts.ready;
}

/** Load a single family (bundled or system-installed). */
export async function ensure_family_loaded(
  family: string,
  weight: FontWeight = 'normal'
): Promise<void> {
  await ensure_fonts_loaded([{ family, weight }]);
}

/**
 * Build font-load descriptors from the image tool's font config keys.
 * Variable fonts use numeric weights; static fonts map to normal/bold files.
 */
export function get_font_load_descriptors(
  font_key: keyof typeof FONT_FAMILY_NAME,
  weight: number
): { family: string; weight: FontWeight; font_key: fonts_type } {
  return {
    family: FONT_FAMILY_NAME[font_key],
    weight: weight_to_font_api(font_key, weight),
    font_key
  };
}
