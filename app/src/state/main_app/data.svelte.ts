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
import { browser } from '$app/environment';
import { delay } from '~/tools/delay';
import { derived, get, writable } from 'svelte/store';
import { lang_list_obj } from '../lang_list';
import { get_node_at_path, build_project_registry } from '../project_list';
import { user_info } from '../user.svelte';
import type { shloka_list_type } from '~/state/data_types';
import ms from 'ms';

/** Keeps previous text visible across query-key changes (e.g. next/prev navigation). */
let last_successful_text_data: shloka_list_type | undefined;
let last_successful_text_project_id: number | null = null;

const get_dynamic_path_params = (
  selected_text_levels: (number | null)[],
  project_levels: number
) => {
  // selected_text_levels is lower -> higher (index 0 is lowest route param).
  // For variable subtree depth, allow trailing nulls on the *lowest* end.
  const params = selected_text_levels.slice(0, project_levels - 1).reverse();
  while (params.length && params[params.length - 1] == null) params.pop();
  if (params.some((v) => v == null)) return [];
  return params as number[];
};

export const project_list_q = createQuery(
  {
    queryKey: ['project_list'],
    queryFn: async () =>
      build_project_registry(await client.project.get_project_list.query(), { sort: false }),
    staleTime: ms('12hours')
  },
  queryClient
);

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

export const project_map_q_options = (project_id: number) => {
  return queryOptions({
    queryKey: ['project_map', project_id],
    queryFn: () => client.project.get_project_map.query({ project_id })
  });
};

/** Derives from the current selected project */
export const project_map_q = get_derived_query([project_state], ([prject_state_]) =>
  createQuery(
    {
      ...project_map_q_options(prject_state_.project_id!),
      enabled: !!prject_state_.project_id && !!prject_state_.project_key
    },
    queryClient
  )
);

// Keep `text_data_present` synced to whether current selection is a leaf shloka node.
derived([project_state, selected_text_levels, project_map_q], ([$ps, $stl, $pmq]) => {
  if (!$pmq.isSuccess) return false;
  const map = $pmq.data;
  const path_params = get_dynamic_path_params($stl, $ps.levels);
  if (path_params.length === 0) return $ps.levels === 1 && map?.info?.type === 'shloka';
  const node = get_node_at_path(map, path_params);
  return node?.info?.type === 'shloka';
}).subscribe((v) => text_data_present.set(!!v));

export const QUERY_KEYS = {
  trans_lang_data: (lang_id: number, selected_text_levels: (number | null)[]) => [
    'trans',
    get(project_state).project_id,
    lang_id,
    ...selected_text_levels.slice(0, get(project_state).levels - 1).reverse()
  ],
  text_data: (path_params: number[]) => ['text_data', get(project_state).project_id, ...path_params]
};

export const text_data_q_options = (
  selected_text_levels: (number | null)[],
  project_key: string,
  project_levels: number
) => {
  const path_params = get_dynamic_path_params(selected_text_levels, project_levels);
  const project_id = get(project_state).project_id;
  return queryOptions({
    queryKey: QUERY_KEYS.text_data(path_params),
    queryFn: async () => {
      const data = await client.text.get_text_data.query({
        project_key: project_key,
        path_params
      });
      last_successful_text_data = data;
      last_successful_text_project_id = project_id ?? null;
      return data;
    },
    placeholderData: () =>
      project_id === last_successful_text_project_id ? last_successful_text_data : undefined
  });
};

export const text_data_q = get_derived_query(
  [project_state, selected_text_levels, text_data_present],
  ([prject_state_, selected_text_levels_, text_data_present_]) =>
    createQuery(
      {
        ...text_data_q_options(
          selected_text_levels_,
          prject_state_.project_key!,
          prject_state_.levels!
        ),
        enabled: text_data_present_
      },
      queryClient
    )
);

export const prefetch_text_data = (
  selected_text_levels: (number | null)[],
  project_key: string,
  project_levels: number
) => {
  if (!browser) return;
  return queryClient.prefetchQuery(
    text_data_q_options(selected_text_levels, project_key, project_levels)
  );
};

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

export const prefetch_translation_data = (
  selected_text_levels: (number | null)[],
  current_trans_lang: number
) => {
  if (!browser) return;
  const prefetches = [
    queryClient.prefetchQuery(
      trans_lang_data_q_options(lang_list_obj.English, selected_text_levels)
    )
  ];
  if (current_trans_lang !== 0 && current_trans_lang !== lang_list_obj.English) {
    prefetches.push(
      queryClient.prefetchQuery(trans_lang_data_q_options(current_trans_lang, selected_text_levels))
    );
  }
  return Promise.all(prefetches);
};

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

  const path_params = get_dynamic_path_params(selected_text_levels, levels);
  if (path_params.length === 0) return 0;
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
    const path_params = get_dynamic_path_params(selected_text_levels, levels);
    if (path_params.length > 0) {
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

export const get_starting_index = (key: string, selected_text_levels?: (number | null)[]) => {
  const lowest_selected =
    selected_text_levels?.find((v): v is number => typeof v === 'number') ?? null;
  let starting = 1;
  if (key === 'bhagavadgita') starting = 4;
  else if (key === 'narayaneeyam') {
    starting = 4;
    if (lowest_selected === 1) starting = 5;
  } else if (key === 'saundarya-lahari') starting = 3;
  return starting;
};
