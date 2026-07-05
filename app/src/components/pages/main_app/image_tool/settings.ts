import { copy_plain_object } from '~/tools/kry';
import { writable } from 'svelte/store';
import {
  bundled_font_family,
  FONT_FAMILY_NAME,
  get_font_family_and_size,
  is_bundled_font_key,
  type font_config_type,
  type fonts_type
} from '~/tools/font_tools';
import type { script_and_lang_list_type } from '~/state/lang_list';

/** Canvas line strokes and text fill colors used by the image tool renderer. */
export const IMAGE_RENDER_COLORS = {
  line: {
    boundingBox: 'hsla(215, 40%, 60%, 1)',
    referenceLine: 'hsla(0, 59%, 41%, 1)'
  },
  text: {
    main: 'hsla(38, 100%, 15%, 1)',
    normal: 'hsla(44, 100%, 10%, 1)',
    number: 'hsla(37, 80%, 25%, 0.8)',
    translation: 'hsla(44, 100%, 10%, 1)'
  }
} as const;

export type ImageTextRenderColors = {
  main: string;
  normal: string;
  /** Shared by main and normal shloka number indicators. */
  number: string;
  translation: string;
};

export type shloka_type_config = {
  bounding_coords: bounding_coords_type;
  main_text_font_size: number;
  norm_text_font_size: number;
  trans_text_font_size: number;
  reference_lines: {
    top: number;
    spacing: number;
  };
};

export type shloka_number_type = 1 | 2 | 3 | 4 | 5;

export const SHLOKA_NUMBER_TYPES: shloka_number_type[] = [1, 2, 3, 4, 5];

export const MAX_SUPPORTED_SHLOKA_LINES = 5;

export function is_supported_shloka_line_count(line_count: number): boolean {
  return line_count >= 1 && line_count <= MAX_SUPPORTED_SHLOKA_LINES;
}

export const DEFAULT_SHLOKA_CONFIG: Record<shloka_number_type, shloka_type_config> = {
  1: {
    bounding_coords: {
      left: 540,
      top: 70,
      right: 1850,
      bottom: 600
    },
    main_text_font_size: 70,
    norm_text_font_size: 48,
    trans_text_font_size: 43.5,
    reference_lines: {
      top: 410,
      spacing: 0
    }
  },
  2: {
    bounding_coords: {
      left: 540,
      top: 70,
      right: 1850,
      bottom: 600
    },
    main_text_font_size: 63,
    norm_text_font_size: 48,
    trans_text_font_size: 43.5,
    reference_lines: {
      top: 310,
      spacing: 200
    }
  },
  3: {
    bounding_coords: {
      left: 540,
      top: 70,
      right: 1850,
      bottom: 600
    },
    main_text_font_size: 55,
    norm_text_font_size: 43,
    trans_text_font_size: 43.5,
    reference_lines: {
      top: 230,
      spacing: 150
    }
  },
  4: {
    bounding_coords: {
      left: 540,
      top: 70,
      right: 1850,
      bottom: 600
    },
    main_text_font_size: 45,
    norm_text_font_size: 38,
    trans_text_font_size: 43.5,
    reference_lines: {
      top: 200,
      spacing: 130
    }
  },
  5: {
    bounding_coords: {
      left: 540,
      top: 40,
      right: 1850,
      bottom: 600
    },
    main_text_font_size: 40,
    norm_text_font_size: 35,
    trans_text_font_size: 43.5,
    reference_lines: {
      top: 150,
      spacing: 110
    }
  }
};

export const DEFAULT_SHLOKA_CONFIG_SHARED = {
  SPACE_ABOVE_REFERENCE_LINE: 5
};
export const SPACE_ABOVE_REFERENCE_LINE = writable(
  DEFAULT_SHLOKA_CONFIG_SHARED.SPACE_ABOVE_REFERENCE_LINE
);
export let shloka_configs = writable(copy_plain_object(DEFAULT_SHLOKA_CONFIG));

export let current_shloka_type = writable<shloka_number_type | undefined>();

export type bounding_coords_type = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const DEFAULT_TRANSLATION_BOUNDING_COORDS: bounding_coords_type = {
  left: 670,
  top: 650,
  right: 1860,
  bottom: 970
};

type image_font_config_type = font_config_type &
  Record<
    script_and_lang_list_type,
    {
      new_line_spacing?: number;
      space_between_main_and_normal?: number;
      text_for_min_line_height?: string;
    }
  >;

/**
 * Overrides the default font image config from `DEFAULT_FONT_MAIN_CONFIG`
 * this is for shloka, this will be inherited for translations as well you have override it
 */
export const SHLOKA_FONT_CONFIG = {
  Devanagari: {
    size: 1.35,
    text_for_min_line_height: 'तु'
  },
  Normal: {
    font: 'ADOBE_DEVANAGARI',
    text_for_min_line_height: 'qypgj'
  },
  Telugu: {
    font: 'NOTO_SERIF_TELUGU',
    size: 0.95,
    space_between_main_and_normal: 6,
    text_for_min_line_height: 'వై'
  },
  Kannada: {
    font: 'NOTO_SERIF_KANNADA',
    size: 0.9,
    space_between_main_and_normal: 6,
    text_for_min_line_height: 'ವೈ'
  },
  Sinhala: {
    font: 'NOTO_SERIF_SINHALA',
    size: 0.8,
    space_between_main_and_normal: 6,
    text_for_min_line_height: 'පූ'
  }
} as image_font_config_type;

/**
 * Default font config for image translation
 * You might need to override values from `DEFAULT_FONT_MAIN_CONFIG`
 */
export const TRANS_FONT_CONFIG = {
  Hindi: {
    font: 'ADOBE_DEVANAGARI',
    size: 1.4,
    new_line_spacing: 0.35,
    text_for_min_line_height: 'तु'
  },
  English: {
    font: 'ADOBE_DEVANAGARI',
    size: 1.2,
    text_for_min_line_height: 'qypgj'
  },
  Telugu: {
    size: 1.05,
    new_line_spacing: 0.35
  },
  Kannada: {
    size: 1.05,
    new_line_spacing: 0.45
  },
  Sinhala: {
    size: 0.9,
    new_line_spacing: 0.45
  }
} as image_font_config_type;

const DEFAULT_IMAGE_CONFIG = {
  new_line_spacing: 0.5,
  space_between_main_and_normal: 1
};

export type ImageFontConfig = {
  family: string;
  key: string;
  size: number;
  new_line_spacing: number;
  space_between_main_and_normal: number;
  text_for_min_height: string | null;
  font_overridden: boolean;
};

export const get_image_font_info = (
  script: script_and_lang_list_type,
  image_context: 'shloka' | 'trans' | null = null!
): ImageFontConfig => {
  const base = get_font_family_and_size(script);
  let key = base.key;
  let family: string = base.family;
  let { size } = base;
  let { new_line_spacing, space_between_main_and_normal } = DEFAULT_IMAGE_CONFIG;
  let text_for_min_height: string | null = null;

  const apply_font_key = (font_key: fonts_type) => {
    key = font_key;
    family = bundled_font_family(font_key);
  };

  let image_main_conf = SHLOKA_FONT_CONFIG[script];
  if (image_main_conf) {
    if (image_main_conf.font) apply_font_key(image_main_conf.font);
    if (image_main_conf.size) size = image_main_conf.size;
    if (image_main_conf.space_between_main_and_normal)
      space_between_main_and_normal = image_main_conf.space_between_main_and_normal;
    if (image_main_conf.text_for_min_line_height)
      text_for_min_height = image_main_conf.text_for_min_line_height;
  }
  image_main_conf = TRANS_FONT_CONFIG[script];
  if (image_context === 'trans' && image_main_conf) {
    if (image_main_conf.font) apply_font_key(image_main_conf.font);
    if (image_main_conf.size) size = image_main_conf.size;
    if (image_main_conf.new_line_spacing) new_line_spacing = image_main_conf.new_line_spacing;
    if (image_main_conf.text_for_min_line_height)
      text_for_min_height = image_main_conf.text_for_min_line_height;
  }

  return {
    family,
    key,
    size,
    new_line_spacing,
    space_between_main_and_normal,
    text_for_min_height,
    font_overridden: false
  };
};

export function resolve_bundled_font_family(
  config: Pick<ImageFontConfig, 'key' | 'family'>
): string {
  if (is_bundled_font_key(config.key)) return bundled_font_family(config.key);
  return config.family;
}

export function is_image_font_at_default(
  config: ImageFontConfig,
  script: script_and_lang_list_type,
  image_context: 'shloka' | 'trans'
): boolean {
  const defaults = get_image_font_info(script, image_context);
  return config.key === defaults.key && !config.font_overridden;
}

export function set_bundled_font_on_config(
  config: ImageFontConfig,
  font_key: fonts_type
): ImageFontConfig {
  return {
    ...config,
    key: font_key,
    family: bundled_font_family(font_key),
    font_overridden: true
  };
}

export function reset_image_font_to_default(
  config: ImageFontConfig,
  script: script_and_lang_list_type,
  image_context: 'shloka' | 'trans'
): ImageFontConfig {
  const defaults = get_image_font_info(script, image_context);
  return {
    ...config,
    key: defaults.key,
    family: defaults.family,
    font_overridden: false
  };
}

export type NumberFontConfig = {
  use_custom: boolean;
  main_key: fonts_type;
  main_family: string;
  norm_key: fonts_type;
  norm_family: string;
};

export const DEFAULT_NUMBER_FONT_CONFIG: NumberFontConfig = {
  use_custom: false,
  main_key: 'ADOBE_DEVANAGARI',
  main_family: FONT_FAMILY_NAME.ADOBE_DEVANAGARI,
  norm_key: 'ROBOTO',
  norm_family: FONT_FAMILY_NAME.ROBOTO
};
