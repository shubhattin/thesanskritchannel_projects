import { get, writable } from 'svelte/store';
import type * as fabric from 'fabric';
import { get_derived_query } from '~/tools/query';
import { browser } from '$app/environment';
import { trans_lang_data_q_options, text_data_q_options } from '~/state/main_app/data.svelte';
import { createQuery } from '@tanstack/svelte-query';
import { queryClient } from '~/state/queryClient';
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
import { get_image_font_info } from './settings';
import { project_state, text_data_present } from '~/state/main_app/state.svelte';

export let canvas = writable<fabric.Canvas>();
export let background_image = writable<fabric.FabricImage>();
export let shaded_background_image_status = writable(import.meta.env.DEV);
export let scaling_factor = writable<number>(0); // Scale factor for the background image

export const IMAGE_DIMENSIONS = [1920, 1080];
export const get_units = (value: number) => {
  return value * get(scaling_factor);
};
export async function set_background_image_type(shaded_image: boolean) {
  const $background_image = get(background_image);
  if (!$background_image) return;
  await $background_image.setSrc(
    shaded_image ? background_image_template_url : background_image_url
  );
  background_image.set($background_image);
  const $canvas = get(canvas);
  $canvas.requestRenderAll();
  canvas.set($canvas);
}

export let image_script = writable<script_list_type>();
export let image_lang = writable<number>(lang_list_obj.English);
export let image_selected_levels = writable<(number | null)[]>([null, null]);

// ^ chapter will be inherited from the main during mount
export let image_shloka = writable(1);
export let image_rendering_state = writable(false);
export let image_shloka_data = writable<shloka_list_type[0]>(null!);

export let zip_download_state = writable<[number, number] | null>(null);

export const image_text_data_q = get_derived_query(
  [image_selected_levels, text_data_present, project_state],
  ([image_selected_levels_, text_data_present_, project_state_]) => {
    return createQuery(
      {
        ...text_data_q_options(
          image_selected_levels_,
          project_state_.project_key!,
          project_state_.levels!
        ),
        enabled: browser && text_data_present_,
        placeholderData: []
      },
      queryClient
    );
  }
);
export const image_trans_data_q = get_derived_query(
  [image_selected_levels, image_lang, text_data_present],
  ([image_selected_levels_, image_lang_, text_data_present_]) => {
    return createQuery(
      {
        ...trans_lang_data_q_options(image_lang_, image_selected_levels_),
        enabled: browser && text_data_present_
      },
      queryClient
    );
  }
);

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
