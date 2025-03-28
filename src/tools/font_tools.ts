import { browser } from '$app/environment';
import {
  LANG_LIST,
  LANG_LIST_IDS,
  lang_list_obj,
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
  return LANG_LIST[LANG_LIST_IDS.indexOf(lang_id)] as script_list_type;
}

/**
 * This loads the font family based on files defined in stylesheets
 */
export const load_font = async (font: string) => {
  await document.fonts.load(`1em ${font}`);
};

export const FONT_FAMILY_NAME = {
  NIRMALA_UI: 'Nirmala UI',
  ADOBE_DEVANAGARI: 'Adobe Devanagari',
  ROBOTO: 'Roboto',
  ADOBE_TELUGU: 'Adobe Telugu',
  NOTO_SERIF_TELUGU: 'Noto Serif Telugu',
  NOTO_SERIF_KANNADA: 'Noto Serif Kannada',
  NOTO_SERIF_SINHALA: 'Noto Serif Sinhala',
  ISKOOLA_POTA: 'Iskoola Pota'
};

type fonts_type = keyof typeof FONT_FAMILY_NAME;
type supported_font_formats = 'ttf' | 'otf';

const FONT_FILE_INFO: Record<
  fonts_type,
  {
    file_name: string;
    file_type: supported_font_formats;
  }
> = {
  NIRMALA_UI: {
    file_name: 'Nirmala',
    file_type: 'ttf'
  },
  ADOBE_DEVANAGARI: {
    file_name: 'AdobeDevanagari',
    file_type: 'otf'
  },
  ROBOTO: {
    file_name: 'Roboto',
    file_type: 'ttf'
  },
  ADOBE_TELUGU: {
    file_name: 'AdobeTelugu',
    file_type: 'otf'
  },
  NOTO_SERIF_TELUGU: {
    file_name: 'NotoSerifTelugu',
    file_type: 'ttf'
  },
  NOTO_SERIF_KANNADA: {
    file_name: 'NotoSerifKannada',
    file_type: 'ttf'
  },
  NOTO_SERIF_SINHALA: {
    file_name: 'NotoSerifSinhala',
    file_type: 'ttf'
  },
  ISKOOLA_POTA: {
    file_name: 'IskoolaPota',
    file_type: 'ttf'
  }
};

export type font_config_type = Record<
  script_and_lang_list_type,
  {
    font?: fonts_type;
    size?: number;
  }
>;

export const get_font_url = (font: fonts_type, type: 'regular' | 'bold') => {
  if (!browser) return '';
  const font_file_info = FONT_FILE_INFO[font];

  const font_url = {
    regular: new URL(
      `/src/fonts/regular/${font_file_info.file_name}.${font_file_info.file_type}`,
      import.meta.url
    ).href,
    bold: new URL(
      `/src/fonts/bold/${font_file_info.file_name}B.${font_file_info.file_type}`,
      import.meta.url
    ).href
  }[type];
  return font_url;
};

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
