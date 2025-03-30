import { get_derived_query } from '~/tools/query';
import { client } from '~/api/client';
import { queryClient } from '~/state/queryClient';
import { createQuery } from '@tanstack/svelte-query';
import {
  project_state,
  selected_text_levels,
  text_data_present,
  editing_status_on,
  view_translation_status,
  trans_lang
} from './state.svelte';
import { page } from '$app/state';
import type { shloka_list_type } from '~/state/data_types';
import { browser } from '$app/environment';
import { delay } from '~/tools/delay';
import { derived, get, writable } from 'svelte/store';
import { lang_list_obj } from '../lang_list';
import { get_map_type, get_project_info_from_key, type project_keys_type } from '../project_list';
import { user_info } from '../user.svelte';
import ms from 'ms';

export const user_project_info_q = get_derived_query(
  [project_state, user_info],
  ([_prject_state, _user_info]) =>
    createQuery(
      {
        queryKey: ['user_project_info', _prject_state.project_id!],
        queryFn: async () => {
          const data = await client.project.user_project_info.query({
            project_id: _prject_state.project_id!
          });
          return data;
        },
        enabled: !!_user_info && !!_prject_state.project_id,
        staleTime: ms('15mins')
      },
      queryClient
    )
);

export const project_map_q = get_derived_query([project_state], ([_prject_state]) =>
  createQuery({
    queryKey: ['project_map', _prject_state.project_id!],
    queryFn: async () => {
      const project_info = get_project_info_from_key(_prject_state.project_key!);
      const data = await project_info.map_info();
      return data;
    }
  })
);

export const QUERY_KEYS = {
  trans_lang_data: (lang_id: number, selected_text_levels: (number | null)[]) => [
    'trans',
    get(project_state).project_id,
    lang_id,
    ...selected_text_levels.slice(0, get(project_state).levels - 1).reverse()
  ],
  text_data: (path_params: (number | null)[]) => [
    'text_data',
    get(project_state).project_id,
    ...path_params
  ]
};

let one_time_page_text_data_use_done = false;

export const get_path_params = (
  selected_text_levels: (number | null)[],
  project_levels: number
) => {
  return selected_text_levels.slice(0, project_levels - 1).reverse();
};

export const text_data_q = get_derived_query(
  [project_state, selected_text_levels, text_data_present],
  ([_prject_state, _selected_text_levels, _text_data_present]) => {
    const path_params = get_path_params(_selected_text_levels, _prject_state.levels!);
    const query = createQuery(
      {
        queryKey: QUERY_KEYS.text_data(path_params),
        queryFn: async () => {
          const data = await client.translation.get_text_data.query({
            project_key: _prject_state.project_key!,
            path_params
          });
          return data;
        },
        enabled: _text_data_present,
        ...(page.data.text && !one_time_page_text_data_use_done
          ? {
              initialData: page.data.text as shloka_list_type
            }
          : {})
      },
      queryClient
    );
    if (page.data.text && browser) one_time_page_text_data_use_done = true;
    return query;
  }
);

// Translations
export const trans_en_data_q = get_derived_query(
  [selected_text_levels, view_translation_status, editing_status_on, text_data_present],
  ([_selected_text_levels, _view_translation_status, _editing_status_on, _text_data_present]) => {
    return createQuery(
      {
        queryKey: QUERY_KEYS.trans_lang_data(lang_list_obj.English, _selected_text_levels),
        // by also adding the kanda and chapter they are auto invalidated
        // so we dont have to manually invalidate it if were only chapter,trans,English
        enabled: browser && _view_translation_status && _text_data_present,
        ...(_editing_status_on
          ? {
              staleTime: Infinity
              // while editing the data should not go stale, else it would refetch lead to data loss
            }
          : {}),
        queryFn: () => get_translations(_selected_text_levels, lang_list_obj.English) // 1 -> English
      },
      queryClient
    );
  }
);

export const trans_lang_data_query_key = derived(
  [trans_lang, selected_text_levels],
  (
    [_trans_lang, _selected_text_levels],
    set: (value: (string | number | (number | null)[] | null)[]) => void
  ) => {
    set(QUERY_KEYS.trans_lang_data(_trans_lang, _selected_text_levels));
  }
);
export const trans_lang_data_q = get_derived_query(
  [
    trans_lang_data_query_key,
    trans_lang,
    selected_text_levels,
    editing_status_on,
    text_data_present
  ],
  ([
    _trans_lang_data_query_key,
    _trans_lang,
    _selected_text_levels,
    _editing_status_on,
    _text_data_present
  ]) =>
    createQuery(
      {
        queryKey: _trans_lang_data_query_key,
        enabled: browser && _trans_lang !== 0 && _text_data_present,
        ...(_editing_status_on
          ? {
              staleTime: Infinity
              // while editing the data should not go stale, else it would refetch lead to data loss
            }
          : {}),
        queryFn: () => get_translations(_selected_text_levels, _trans_lang)
      },
      queryClient
    )
);
export async function get_translations(selected_text_levels: (number | null)[], lang_id: number) {
  await delay(400);
  const data_map = await client.translation.get_translation.query({
    project_id: get(project_state).project_id!,
    lang_id: lang_id,
    selected_text_levels
  });
  return data_map;
}

export let english_edit_status = writable(false);

export let bulk_text_edit_status = writable(false);
export let bulk_text_data = writable('');

/**
 * If you are caaling this func in UI then also call
 * `$project_map_q.isSuccess` to make sure the data is available
 */
export let get_total_count = (selected_text_levels: (number | null)[]) => {
  const _project_map_q = get(project_map_q);
  const { levels } = get(project_state);
  if (!_project_map_q.isSuccess) return 0;
  const project_map = _project_map_q.data;

  let total_count = 0;
  if (levels === 2) {
    total_count = get_map_type(project_map, 2)[selected_text_levels[0]! - 1].total;
  } else if (levels === 3) {
    total_count = get_map_type(project_map, 3)[selected_text_levels[1]! - 1].list[
      selected_text_levels[0]! - 1
    ].total;
  } else if (levels === 2) {
    total_count = get_map_type(project_map, 1).total;
  }
  return total_count;
};

export const get_last_level_name = (selected_text_levels: (number | null)[]) => {
  const _project_map_q = get(project_map_q);
  const { levels } = get(project_state);
  if (!_project_map_q.isSuccess)
    return {
      dev: '',
      nor: ''
    };
  let dev = '';
  let nor = '';
  const project_map = _project_map_q.data;

  if (levels === 2) {
    dev = get_map_type(project_map, 2)[selected_text_levels[0]! - 1].name_dev;
    nor = get_map_type(project_map, 2)[selected_text_levels[0]! - 1].name_nor;
  } else if (levels === 3) {
    dev = get_map_type(project_map, 3)[selected_text_levels[1]! - 1].list[
      selected_text_levels[0]! - 1
    ].name_dev;
    nor = get_map_type(project_map, 3)[selected_text_levels[1]! - 1].list[
      selected_text_levels[0]! - 1
    ].name_nor;
  }

  return {
    dev,
    nor
  };
};

export const get_starting_index = (
  key: project_keys_type,
  selected_text_levels?: (number | null)[]
) => {
  let starting = 1;
  if (key === 'bhagavadgita') starting = 4;
  else if (key === 'narayaneeyam') {
    starting = 4;
    if (selected_text_levels && selected_text_levels[0] === 1) starting = 5;
  }
  return starting;
};
