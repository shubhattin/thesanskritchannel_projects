import { get_derived_query } from '~/tools/query';
import { client } from '~/api/client';
import { queryClient } from '~/state/queryClient';
import { createQuery, queryOptions } from '@tanstack/svelte-query';
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
import {
  get_path_params,
  get_node_at_path,
  get_project_from_key,
  type project_keys_type
} from '../project_list';
import { user_info } from '../user.svelte';

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
        enabled: !!_user_info && !!_prject_state.project_id
      },
      queryClient
    )
);

export const project_map_q_options = (project_id: number, project_key: project_keys_type) => {
  return queryOptions({
    queryKey: ['project_map', project_id],
    queryFn: async () => {
      return await get_project_from_key(project_key).get_map();
    }
  });
};

export const project_map_q = get_derived_query([project_state], ([prject_state_]) =>
  createQuery(
    project_map_q_options(prject_state_.project_id!, prject_state_.project_key!),
    queryClient
  )
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

export const text_data_q_options = (
  selected_text_levels: (number | null)[],
  project_key: project_keys_type,
  project_levels: number
) => {
  const path_params = get_path_params(selected_text_levels, project_levels);
  return queryOptions({
    queryKey: QUERY_KEYS.text_data(path_params),
    queryFn: async () => {
      const data = await client.text.get_text_data.query({
        project_key: project_key,
        path_params
      });
      return data;
    }
  });
};

export const text_data_q = get_derived_query(
  [project_state, selected_text_levels, text_data_present],
  ([prject_state_, selected_text_levels_, text_data_present_]) => {
    const query = createQuery(
      {
        ...text_data_q_options(
          selected_text_levels_,
          prject_state_.project_key!,
          prject_state_.levels!
        ),
        enabled: text_data_present_,
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
export const trans_lang_data_q_options = (
  lang_id: number,
  selected_text_levels: (number | null)[]
) => {
  return queryOptions({
    queryKey: QUERY_KEYS.trans_lang_data(lang_id, selected_text_levels),
    queryFn: () => get_translations(selected_text_levels, lang_id)
  });
};

export const trans_en_data_q = get_derived_query(
  [selected_text_levels, view_translation_status, editing_status_on, text_data_present],
  ([selected_text_levels_, view_translation_status_, editing_status_on_, text_data_present_]) => {
    return createQuery(
      {
        ...trans_lang_data_q_options(lang_list_obj.English, selected_text_levels_),
        // by also adding the kanda and chapter they are auto invalidated
        // so we dont have to manually invalidate it if were only chapter,trans,English
        enabled: browser && view_translation_status_ && text_data_present_,
        ...(editing_status_on_
          ? {
              staleTime: Infinity
              // while editing the data should not go stale, else it would refetch lead to data loss
            }
          : {})
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
  [trans_lang, selected_text_levels, editing_status_on, text_data_present],
  ([trans_lang_, selected_text_levels_, editing_status_on_, text_data_present_]) =>
    createQuery(
      {
        ...trans_lang_data_q_options(trans_lang_, selected_text_levels_),
        enabled: browser && trans_lang_ !== 0 && text_data_present_,
        ...(editing_status_on_
          ? {
              staleTime: Infinity
              // while editing the data should not go stale, else it would refetch lead to data loss
            }
          : {})
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

  if (levels === 1) return project_map?.info?.type === 'shloka' ? (project_map.info.total ?? 0) : 0;

  // need complete selection to compute leaf total
  for (let i = 0; i < levels - 1; i++) if (!selected_text_levels[i]) return 0;
  const path_params = selected_text_levels.slice(0, levels - 1).reverse() as number[];
  const node = get_node_at_path(project_map, path_params);
  if (!node || node.info.type !== 'shloka') return 0;
  return node.info.total ?? 0;
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

  if (levels === 1) {
    dev = project_map?.name_dev ?? '';
    nor = project_map?.name_nor ?? '';
  } else {
    if (selected_text_levels[0]) {
      // best-effort: if higher levels are missing, this will still resolve to the last valid node
      const path_params = selected_text_levels
        .slice(0, levels - 1)
        .reverse()
        .filter((v): v is number => typeof v === 'number');
      const node = get_node_at_path(project_map, path_params);
      dev = node?.name_dev ?? '';
      nor = node?.name_nor ?? '';
    }
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
  } else if (key === 'saundaryalahari') starting = 3;
  return starting;
};
