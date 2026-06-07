import { get_derived_query } from '~/tools/query';
import { client } from '~/api/client';
import { queryClient } from '~/state/queryClient';
import { createQuery, queryOptions } from '@tanstack/svelte-query';
import {
  project_state,
  selected_text_levels,
  text_data_present,
  editing_mode,
  selected_translation_lang_ids,
  trans_lang,
  type editing_mode_type
} from './state.svelte';
import { browser } from '$app/environment';
import { delay } from '~/tools/delay';
import { derived, get, writable } from 'svelte/store';
import { lang_list_obj } from '../lang_list';
import { get_node_at_path, build_project_registry } from '../project_list';
import type { shloka_list_type } from '~/state/data_types';
import ms from 'ms';
import { build_content_session_scope, get_dynamic_path_params } from './query_key_helpers';

export { build_content_session_scope };

/** Keeps previous text visible across query-key changes (e.g. next/prev navigation). */
let last_successful_text_data: shloka_list_type | undefined;
let last_successful_text_project_id: number | null = null;

const has_translation_query_path = (
  selected_text_levels: (number | null)[],
  project_levels: number
) =>
  project_levels === 1 || get_dynamic_path_params(selected_text_levels, project_levels).length > 0;

const pin_query_while_editing = (editing_mode_: editing_mode_type) =>
  editing_mode_ !== 'none' ? { staleTime: Infinity } : {};

export const project_list_q = createQuery(
  {
    queryKey: ['project_list'],
    queryFn: async () =>
      build_project_registry((await client.project.get_project_list.query({ all: true })).list),
    staleTime: ms('12hours')
  },
  queryClient
);

export const invalidate_project_list_queries = () =>
  queryClient.invalidateQueries({ queryKey: ['project_list'] });

export const invalidate_project_map_queries = (project_id?: number) =>
  queryClient.invalidateQueries({
    queryKey: project_id === undefined ? ['project_map'] : ['project_map', project_id]
  });

/** Refreshes project list and, when given, that project’s map query. */
export const invalidate_project_registry_queries = async (project_id?: number) => {
  await Promise.all([
    invalidate_project_list_queries(),
    project_id !== undefined ? invalidate_project_map_queries(project_id) : Promise.resolve()
  ]);
};

export const invalidate_langs_with_translations_queries = (project_key?: string) =>
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'langs_with_translations' &&
      (project_key === undefined || query.queryKey[1] === project_key)
  });

export const invalidate_project_content_queries = async (project_id?: number) => {
  const project_key =
    project_id === undefined ? undefined : (get(project_state).project_key ?? undefined);

  if (project_id === undefined) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['text_data'] }),
      queryClient.invalidateQueries({ queryKey: ['trans'] }),
      invalidate_langs_with_translations_queries()
    ]);
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'text_data' && query.queryKey[1] === project_id
    }),
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'trans' && query.queryKey[1] === project_id
    }),
    invalidate_langs_with_translations_queries(project_key)
  ]);
};

export const user_project_info_q = get_derived_query([project_state], ([_prject_state]) =>
  createQuery(
    {
      queryKey: ['user_project_info', _prject_state.project_id!],
      queryFn: async () => {
        const data = await client.project.user_project_info.query({
          project_id: _prject_state.project_id!
        });
        return data;
      },
      enabled: !!_prject_state.project_id
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
  trans_lang_data: (
    lang_id: number,
    selected_text_levels: (number | null)[],
    project_levels = get(project_state).levels
  ) => [
    'trans',
    get(project_state).project_id,
    lang_id,
    ...get_dynamic_path_params(selected_text_levels, project_levels)
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
  [project_state, selected_text_levels, text_data_present, editing_mode],
  ([prject_state_, selected_text_levels_, text_data_present_, editing_mode_]) =>
    createQuery(
      {
        ...text_data_q_options(
          selected_text_levels_,
          prject_state_.project_key!,
          prject_state_.levels!
        ),
        enabled: text_data_present_,
        ...pin_query_while_editing(editing_mode_)
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

export const langs_with_translations_q = get_derived_query(
  [project_state, selected_text_levels, text_data_present],
  ([project_state_, selected_text_levels_, text_data_present_]) => {
    const path_params = get_dynamic_path_params(selected_text_levels_, project_state_.levels);
    return createQuery(
      {
        queryKey: ['langs_with_translations', project_state_.project_key, ...path_params],
        queryFn: () =>
          client.translation.get_langs_with_translations.query({
            project_key: project_state_.project_key!,
            path_params
          }),
        enabled:
          browser &&
          text_data_present_ &&
          !!project_state_.project_key &&
          has_translation_query_path(selected_text_levels_, project_state_.levels),
        staleTime: ms('5minutes')
      },
      queryClient
    );
  }
);

export const trans_en_data_q = get_derived_query(
  [project_state, selected_text_levels, editing_mode, text_data_present],
  ([project_state_, selected_text_levels_, editing_mode_, text_data_present_]) => {
    const query_has_path = has_translation_query_path(selected_text_levels_, project_state_.levels);
    return createQuery(
      {
        ...trans_lang_data_q_options(
          lang_list_obj.English,
          selected_text_levels_,
          project_state_.levels
        ),
        enabled: browser && text_data_present_ && query_has_path,
        ...pin_query_while_editing(editing_mode_)
      },
      queryClient
    );
  }
);

export const trans_lang_data_query_key = derived(
  [trans_lang, selected_text_levels, project_state],
  ([_trans_lang, _selected_text_levels, _project_state]) =>
    trans_lang_data_q_options(_trans_lang, _selected_text_levels, _project_state.levels).queryKey
);

export const trans_lang_data_q = get_derived_query(
  [project_state, trans_lang, selected_text_levels, editing_mode, text_data_present],
  ([project_state_, trans_lang_, selected_text_levels_, editing_mode_, text_data_present_]) => {
    const query_has_path = has_translation_query_path(selected_text_levels_, project_state_.levels);
    return createQuery(
      {
        ...trans_lang_data_q_options(trans_lang_, selected_text_levels_, project_state_.levels),
        enabled: browser && trans_lang_ !== 0 && text_data_present_ && query_has_path,
        ...pin_query_while_editing(editing_mode_)
      },
      queryClient
    );
  }
);

export const trans_slot_data_query_key = derived(
  [selected_translation_lang_ids, selected_text_levels, project_state],
  ([$selected_translation_lang_ids, $selected_text_levels, $project_state]) =>
    [
      trans_lang_data_q_options(
        $selected_translation_lang_ids[0] ?? -1,
        $selected_text_levels,
        $project_state.levels
      ).queryKey,
      trans_lang_data_q_options(
        $selected_translation_lang_ids[1] ?? -1,
        $selected_text_levels,
        $project_state.levels
      ).queryKey
    ] as const
);

export const trans_slot_1_data_q = get_derived_query(
  [
    project_state,
    selected_translation_lang_ids,
    selected_text_levels,
    editing_mode,
    text_data_present
  ],
  ([
    project_state_,
    selected_translation_lang_ids_,
    selected_text_levels_,
    editing_mode_,
    text_data_present_
  ]) => {
    const lang_id = selected_translation_lang_ids_[0];
    const query_has_path = has_translation_query_path(selected_text_levels_, project_state_.levels);
    return createQuery(
      {
        ...trans_lang_data_q_options(lang_id ?? -1, selected_text_levels_, project_state_.levels),
        enabled: browser && lang_id !== null && text_data_present_ && query_has_path,
        ...(editing_mode_ === '1st_lang' || editing_mode_ === 'text'
          ? {
              staleTime: Infinity
            }
          : {})
      },
      queryClient
    );
  }
);

export const trans_slot_2_data_q = get_derived_query(
  [
    project_state,
    selected_translation_lang_ids,
    selected_text_levels,
    editing_mode,
    text_data_present
  ],
  ([
    project_state_,
    selected_translation_lang_ids_,
    selected_text_levels_,
    editing_mode_,
    text_data_present_
  ]) => {
    const lang_id = selected_translation_lang_ids_[1];
    const query_has_path = has_translation_query_path(selected_text_levels_, project_state_.levels);
    return createQuery(
      {
        ...trans_lang_data_q_options(lang_id ?? -1, selected_text_levels_, project_state_.levels),
        enabled: browser && lang_id !== null && text_data_present_ && query_has_path,
        ...(editing_mode_ === '2nd_lang' || editing_mode_ === 'text'
          ? {
              staleTime: Infinity
            }
          : {})
      },
      queryClient
    );
  }
);

export const trans_lang_data_q_options = (
  lang_id: number,
  selected_text_levels: (number | null)[],
  project_levels = get(project_state).levels
) => {
  return queryOptions({
    queryKey: QUERY_KEYS.trans_lang_data(lang_id, selected_text_levels, project_levels),
    queryFn: () => get_translations(selected_text_levels, lang_id)
  });
};

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
  const project_levels = get(project_state).levels;
  if (!has_translation_query_path(selected_text_levels, project_levels)) return;
  const prefetches = [
    queryClient.prefetchQuery(
      trans_lang_data_q_options(lang_list_obj.English, selected_text_levels, project_levels)
    )
  ];
  if (current_trans_lang !== 0 && current_trans_lang !== lang_list_obj.English) {
    prefetches.push(
      queryClient.prefetchQuery(
        trans_lang_data_q_options(current_trans_lang, selected_text_levels, project_levels)
      )
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
  if (!_project_map_q.isSuccess) return '';
  const project_map = _project_map_q.data;

  if (levels === 1) {
    return project_map?.name_dev ?? '';
  } else {
    const path_params = get_dynamic_path_params(selected_text_levels, levels);
    if (path_params.length > 0) {
      const node = get_node_at_path(project_map, path_params);
      return node?.name_dev ?? '';
    }
  }

  return '';
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
