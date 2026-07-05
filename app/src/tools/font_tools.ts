import { browser } from '$app/environment';
import {
  get_lang_from_id,
  LANG_LIST,
  LANG_LIST_IDS,
  lang_list_obj,
  LANG_SCRIPT_MAP,
  type script_and_lang_list_type,
  type script_list_type
} from '~/state/lang_list';

export const LATIN_BASED_SCRIPTS = ['English', 'Romanized', 'Normal'];

export function get_text_font_class(lang: script_and_lang_list_type | '') {
  // this will be udually used to display in select tags
  if (LATIN_BASED_SCRIPTS.includes(lang)) return '';
  return 'indic-font';
}

export function get_script_for_lang(lang_id: number): script_list_type {
  if (lang_id === lang_list_obj.Hindi || lang_id === lang_list_obj.English) return 'Devanagari';
  // ^ Name for Sanskrit value in the dropdown is Devanagari
  else if (lang_id === lang_list_obj.Tamil) return 'Tamil-Extended';
  // Add a default return value to satisfy the return type
  const lang = get_lang_from_id(lang_id);
  if (LANG_SCRIPT_MAP[lang]) {
    return LANG_SCRIPT_MAP[lang];
  }

  return LANG_LIST[LANG_LIST_IDS.indexOf(lang_id)] as script_list_type;
}

export const FONT_FAMILY_NAME = {
  NIRMALA_UI: 'Nirmala UI',
  ADOBE_DEVANAGARI: 'Adobe Devanagari',
  NOTO_SANS_DEVANAGARI: 'Noto Sans Devanagari',
  NOTO_SERIF_DEVANAGARI: 'Noto Serif Devanagari',
  ROBOTO: 'Roboto',
  HELVETICA: 'Helvetica',
  ADOBE_TELUGU: 'Adobe Telugu',
  NOTO_SERIF_TELUGU: 'Noto Serif Telugu',
  NOTO_SERIF_KANNADA: 'Noto Serif Kannada',
  NOTO_SERIF_SINHALA: 'Noto Serif Sinhala',
  ISKOOLA_POTA: 'Iskoola Pota'
} as const;

export type fonts_type = keyof typeof FONT_FAMILY_NAME;

export const BUNDLED_FONT_OPTIONS = (
  Object.entries(FONT_FAMILY_NAME) as [fonts_type, string][]
).map(([key, family]) => ({ key, family }));

export function is_bundled_font_key(key: string): key is fonts_type {
  return Object.hasOwn(FONT_FAMILY_NAME, key);
}

export function bundled_font_family(key: fonts_type): string {
  return FONT_FAMILY_NAME[key];
}

/** Static fonts use separate regular/bold files; variable fonts use one woff2 with a weight axis. */
export type FontAssetKind = 'static' | 'variable';

export type FontFileInfo = {
  file_name: string;
  kind: FontAssetKind;
};

export const FONT_FILE_INFO: Record<fonts_type, FontFileInfo> = {
  NIRMALA_UI: {
    file_name: 'Nirmala',
    kind: 'static'
  },
  ADOBE_DEVANAGARI: {
    file_name: 'AdobeDevanagari',
    kind: 'static'
  },
  NOTO_SANS_DEVANAGARI: {
    file_name: 'NotoSansDevanagari',
    kind: 'variable'
  },
  NOTO_SERIF_DEVANAGARI: {
    file_name: 'NotoSerifDevanagari',
    kind: 'variable'
  },
  ROBOTO: {
    file_name: 'Roboto',
    kind: 'static'
  },
  HELVETICA: {
    file_name: 'Helvetica',
    kind: 'static'
  },
  ADOBE_TELUGU: {
    file_name: 'AdobeTelugu',
    kind: 'static'
  },
  NOTO_SERIF_TELUGU: {
    file_name: 'NotoSerifTelugu',
    kind: 'variable'
  },
  NOTO_SERIF_KANNADA: {
    file_name: 'NotoSerifKannada',
    kind: 'variable'
  },
  NOTO_SERIF_SINHALA: {
    file_name: 'NotoSerifSinhala',
    kind: 'variable'
  },
  ISKOOLA_POTA: {
    file_name: 'IskoolaPota',
    kind: 'static'
  }
};

export function is_variable_bundled_font(font: fonts_type): boolean {
  return FONT_FILE_INFO[font].kind === 'variable';
}

/** CSS / Font Loading API weight for bundled fonts. */
export function bundled_font_weight(
  font: fonts_type,
  variant: 'regular' | 'bold' | 'normal'
): number | 'normal' | 'bold' {
  const is_bold = variant === 'bold';
  if (is_variable_bundled_font(font)) {
    return is_bold ? 700 : 400;
  }
  return is_bold ? 'bold' : 'normal';
}

export function get_font_asset_path(font: fonts_type, variant: 'regular' | 'bold'): string {
  const { file_name, kind } = FONT_FILE_INFO[font];
  if (kind === 'variable') {
    return `variable/woff2/${file_name}.woff2`;
  }
  if (variant === 'bold') {
    return `bold/woff2/${file_name}B.woff2`;
  }
  return `regular/woff2/${file_name}.woff2`;
}

export const get_font_url = (font: fonts_type, type: 'regular' | 'bold') => {
  if (!browser) return '';
  const path = get_font_asset_path(font, type);
  return new URL(`/src/fonts/${path}`, import.meta.url).href;
};

export type font_config_type = Record<
  script_and_lang_list_type,
  {
    font?: fonts_type;
    size?: number;
  }
>;

/**
 * Default font config for main web app
 */
const MAIN_FONT_CONFIG = {
  English: {
    font: 'ROBOTO'
  },
  Romanized: {
    font: 'ROBOTO'
  },
  Normal: {
    font: 'ROBOTO'
  },
  Devanagari: {
    font: 'ADOBE_DEVANAGARI',
    size: 1.45
  },
  Sanskrit: {
    font: 'ADOBE_DEVANAGARI',
    size: 1.45
  },
  Telugu: {
    font: 'NOTO_SERIF_TELUGU',
    size: 1.25
  },
  Kannada: {
    font: 'NOTO_SERIF_KANNADA',
    size: 1.2
  },
  Sinhala: {
    font: 'NOTO_SERIF_SINHALA',
    size: 1
  }
} as font_config_type;

const DEFAULT_FONT_CONFIG = {
  font: 'NIRMALA_UI',
  size: 1
};
/**
 * `size` is in rem
 */
export const get_font_family_and_size = (script: script_and_lang_list_type) => {
  let key: fonts_type = DEFAULT_FONT_CONFIG.font as fonts_type;
  let { size } = DEFAULT_FONT_CONFIG;

  const main_app_conf = MAIN_FONT_CONFIG[script];
  if (main_app_conf) {
    if (main_app_conf.font) key = main_app_conf.font;
    if (main_app_conf.size) size = main_app_conf.size;
  }

  return {
    family: FONT_FAMILY_NAME[key],
    size,
    key
  };
};
