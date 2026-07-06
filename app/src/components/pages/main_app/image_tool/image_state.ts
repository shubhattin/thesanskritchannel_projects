import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
  trans_lang_data_q_options,
  text_data_q_options,
  type ProjectState
} from '~/state/main_app/data.svelte';
import background_image_url from './img/background_vr.png';
import background_image_template_url from './img/background_vr_template.jpg';
import {
  LANG_LIST,
  lang_list_obj,
  SCRIPT_LIST,
  type lang_list_type,
  type script_list_type
} from '~/state/lang_list';
import { type shloka_list_type } from '~/state/data_types';
import { copy_plain_object } from '~/tools/kry';
import {
  DEFAULT_TRANSLATION_BOUNDING_COORDS,
  DEFAULT_NUMBER_FONT_CONFIG,
  get_image_font_info,
  IMAGE_RENDER_COLORS,
  type ImageTextRenderColors,
  type NumberFontConfig
} from './settings';
import { EMPTY_SYSTEM_FONT_OVERRIDES, type ImageSystemFontOverrides } from './system_fonts';
import type Konva from 'konva';

/** Reference to the Konva Stage node — set by ImageTool once mounted. */
export let stage_node = writable<Konva.Stage | null>(null);

/** URL of the background image currently displayed. */
export const BACKGROUND_IMAGE_URLS = {
  normal: background_image_url,
  template: background_image_template_url
} as const;

export let shaded_background_image_status = writable(false);
export let scaling_factor = writable<number>(0); // Scale factor for the canvas

export const IMAGE_DIMENSIONS = [1920, 1080] as const;

/** Whether fonts needed for image rendering have been loaded. */
export let fonts_loaded = writable(false);

// --- Data state ---
export let image_script = writable<script_list_type>();
export let image_lang = writable<number>(lang_list_obj.English);
export let image_selected_levels = writable<(number | null)[]>([null, null]);
export let show_image_on_top_right = writable(false);

// ^ chapter will be inherited from the main during mount
export let image_shloka = writable(1);
export let image_rendering_state = writable(false);
/** The shloka data for the current image. */
export let image_shloka_data = writable<shloka_list_type[0]>(null!);
/** The translation text for the current image. */
export let image_trans_text = writable('');

export const DEFAULT_IMAGE_TEXT_RENDER_COLORS: ImageTextRenderColors = copy_plain_object(
  IMAGE_RENDER_COLORS.text
);
export let image_render_colors = writable<ImageTextRenderColors>(
  copy_plain_object(DEFAULT_IMAGE_TEXT_RENDER_COLORS)
);

export function set_image_text_color(key: keyof ImageTextRenderColors, value: string) {
  image_render_colors.update((colors) => ({ ...colors, [key]: value }));
}

export let zip_download_state = writable<[number, number] | null>(null);

/** Bumped to clear per-element drag offsets in ImageTool. */
export let image_drag_reset_nonce = writable(0);

export const reset_image_drag_positions = () => {
  image_drag_reset_nonce.update((n) => n + 1);
};

export const image_text_data_q_options = (
  image_selected_levels: (number | null)[],
  project: ProjectState | null,
  text_data_present_: boolean
) => ({
  ...text_data_q_options(image_selected_levels, project),
  enabled: browser && text_data_present_,
  placeholderData: [] as shloka_list_type
});

export const image_trans_data_q_options = (
  image_selected_levels: (number | null)[],
  image_lang: number,
  project: ProjectState | null,
  text_data_present_: boolean
) => ({
  ...trans_lang_data_q_options(image_lang, image_selected_levels, project),
  enabled: browser && text_data_present_
});

// Language and Script Specific Settings

type image_font_config_type<T extends string> = Record<T, ReturnType<typeof get_image_font_info>>;
export const DEFAULT_MAIN_TEXT_FONT_CONFIGS = (() => {
  const res: any = {};
  SCRIPT_LIST.filter((src) => !['Normal'].includes(src)).forEach(
    (script) =>
      (res[script as script_list_type] = get_image_font_info(script as script_list_type, 'shloka'))
  );
  return res as image_font_config_type<script_list_type>;
})();
export let main_text_font_configs = writable(copy_plain_object(DEFAULT_MAIN_TEXT_FONT_CONFIGS));
export let normal_text_font_config = writable(
  copy_plain_object(get_image_font_info('Normal', 'shloka'))
);
export const DEFAULT_TRANS_TEXT_FONT_CONFIGS = (() => {
  const res: any = {};
  LANG_LIST.forEach(
    (lang) => (res[lang as script_list_type] = get_image_font_info(lang as lang_list_type, 'trans'))
  );
  return res as image_font_config_type<lang_list_type>;
})();
export let trans_text_font_configs = writable(copy_plain_object(DEFAULT_TRANS_TEXT_FONT_CONFIGS));

/** Per-role system font family names; saved/restored via image tool presets. */
export let system_font_overrides = writable<ImageSystemFontOverrides>(
  copy_plain_object(EMPTY_SYSTEM_FONT_OVERRIDES)
);

export let number_font_config = writable<NumberFontConfig>(
  copy_plain_object(DEFAULT_NUMBER_FONT_CONFIG)
);

export let translation_bounding_coords = writable(
  copy_plain_object(DEFAULT_TRANSLATION_BOUNDING_COORDS)
);
