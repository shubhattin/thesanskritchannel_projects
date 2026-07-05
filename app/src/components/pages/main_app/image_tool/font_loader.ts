import { bundled_font_weight, FONT_FAMILY_NAME, type fonts_type } from '~/tools/font_tools';

const loaded_fonts = new Set<string>();

type FontWeight = 'normal' | 'bold' | number;

/**
 * Ensures the given font families are loaded via the browser's native font loading API.
 * Bundled fonts must already be declared via CSS `@font-face` rules (see `app.scss`).
 */
export async function ensure_fonts_loaded(
  families: { family: string; weight: FontWeight; font_key?: fonts_type }[]
): Promise<void> {
  const to_load = families.filter((f) => !loaded_fonts.has(`${f.family}:${f.weight}`));
  if (to_load.length === 0) return;

  await Promise.all(
    to_load.map(async ({ family, weight }) => {
      const key = `${family}:${weight}`;
      try {
        await document.fonts.load(`${weight} 48px "${family}"`);
        await document.fonts.ready;
        loaded_fonts.add(key);
      } catch {
        console.warn(`[font_loader] Could not load font: ${key}`);
      }
    })
  );
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
 * Variable fonts use numeric weights (400/700); static fonts use normal/bold.
 */
export function get_font_load_descriptors(
  font_key: keyof typeof FONT_FAMILY_NAME,
  weight: 'normal' | 'bold'
): { family: string; weight: FontWeight; font_key: fonts_type } {
  return {
    family: FONT_FAMILY_NAME[font_key],
    weight: bundled_font_weight(font_key, weight),
    font_key
  };
}
