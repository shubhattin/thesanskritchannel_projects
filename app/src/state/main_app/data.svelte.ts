import { client } from '~/api/client';
import { queryClient } from '~/state/queryClient';
import { queryOptions } from '@tanstack/svelte-query';
import { type editing_mode_type, type ProjectState, project_state } from './state.svelte';
import { browser } from '$app/environment';
import { delay } from '~/tools/delay';
import { get, writable } from 'svelte/store';
import { lang_list_obj } from '../lang_list';
import { get_node_at_path, build_project_registry } from '../project_list';
import type { recursive_list_type, shloka_list_type } from '~/state/data_types';
import ms from 'ms';
import { build_content_session_scope, get_dynamic_path_params } from './query_key_helpers';

export type { ProjectState };
export { build_content_session_scope };

/** Keeps previous text visible across query-key changes (e.g. next/prev navigation). */
let last_successful_text_data: shloka_list_type | undefined;
let last_successful_text_project_id: number | null = null;

export const has_translation_query_path = (
  selected_text_levels: (number | null)[],
  project_levels: number
) =>
  project_levels === 1 || get_dynamic_path_params(selected_text_levels, project_levels).length > 0;

export const pin_query_while_editing = (editing_mode_: editing_mode_type) =>
  editing_mode_ !== 'none' ? { staleTime: Infinity } : {};

export const translation_query_enabled = (
  text_data_present_: boolean,
  project: ProjectState | null,
  selected_text_levels: (number | null)[]
) =>
  browser &&
  text_data_present_ &&
  project !== null &&
  has_translation_query_path(selected_text_levels, project.levels);

export const project_list_q_options = () =>
  queryOptions({
    queryKey: ['project_list'],
    queryFn: async () =>
      build_project_registry((await client.project.get_project_list.query({ all: true })).list),
    staleTime: ms('12hours')
  });

export const user_project_info_q_options = (
  user_id: string | undefined,
  project: ProjectState | null
) =>
  queryOptions({
    queryKey: ['user_project_info', user_id, project?.project_id ?? null],
    queryFn: async () => {
      const data = await client.project.user_project_info.query({
        project_id: project!.project_id
      });
      return data;
    },
    enabled: project !== null && !!user_id
  });

export const project_map_q_options = (project: ProjectState | null) =>
  queryOptions({
    queryKey: ['project_map', project?.project_id ?? null],
    queryFn: () => client.project.get_project_map.query({ project_id: project!.project_id }),
    enabled: project !== null
  });

export const compute_text_data_present = (
  project: ProjectState | null,
  selected_text_levels: (number | null)[],
  project_map: recursive_list_type | undefined,
  map_query_success: boolean
) => {
  if (!project || !map_query_success || !project_map) return false;
  const path_params = get_dynamic_path_params(selected_text_levels, project.levels);
  if (path_params.length === 0) return project.levels === 1 && project_map?.info?.type === 'shloka';
  const node = get_node_at_path(project_map, path_params);
  return node?.info?.type === 'shloka';
};

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
    project_id === undefined ? undefined : (get(project_state)?.project_key ?? undefined);

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

const trans_lang_data_query_key = (
  lang_id: number,
  project_id: number | null,
  selected_text_levels: (number | null)[],
  project_levels: number
) =>
  [
    'trans',
    project_id,
    lang_id,
    ...get_dynamic_path_params(selected_text_levels, project_levels)
  ] as const;

const text_data_query_key = (project_id: number | null, path_params: number[]) =>
  ['text_data', project_id, ...path_params] as const;

export const QUERY_KEYS = {
  trans_lang_data: (
    lang_id: number,
    selected_text_levels: (number | null)[],
    project: ProjectState | null
  ) =>
    trans_lang_data_query_key(
      lang_id,
      project?.project_id ?? null,
      selected_text_levels,
      project?.levels ?? 0
    ),
  text_data: (project: ProjectState | null, path_params: number[]) =>
    text_data_query_key(project?.project_id ?? null, path_params)
};

export const text_data_q_options = (
  selected_text_levels: (number | null)[],
  project: ProjectState | null
) => {
  const path_params = get_dynamic_path_params(selected_text_levels, project?.levels ?? 0);
  const project_id = project?.project_id ?? null;
  return queryOptions({
    queryKey: QUERY_KEYS.text_data(project, path_params),
    queryFn: async () => {
      const data = await client.text.get_text_data.query({
        project_key: project!.project_key,
        path_params
      });
      last_successful_text_data = data;
      last_successful_text_project_id = project_id;
      return data;
    },
    placeholderData: () =>
      project_id === last_successful_text_project_id ? last_successful_text_data : undefined,
    enabled: project !== null
  });
};

/**
 * Returns the query options for the active text data query.
 * Its pinned while editing. And disabled if no project or text data is present.
 */
export const active_text_data_q_options = (
  selected_text_levels: (number | null)[],
  project: ProjectState | null,
  text_data_present_: boolean,
  editing_mode_: editing_mode_type
) => ({
  ...text_data_q_options(selected_text_levels, project),
  enabled: project !== null && text_data_present_,
  ...pin_query_while_editing(editing_mode_)
});

export const langs_with_translations_q_options = (
  selected_text_levels: (number | null)[],
  project: ProjectState | null
) => {
  const path_params = get_dynamic_path_params(selected_text_levels, project?.levels ?? 0);
  return queryOptions({
    queryKey: ['langs_with_translations', project?.project_key ?? null, ...path_params],
    queryFn: () =>
      client.translation.get_langs_with_translations.query({
        project_key: project!.project_key,
        path_params
      }),
    staleTime: ms('5minutes'),
    enabled: project !== null
  });
};

export const active_langs_with_translations_q_options = (
  selected_text_levels: (number | null)[],
  project: ProjectState | null,
  text_data_present_: boolean
) => ({
  ...langs_with_translations_q_options(selected_text_levels, project),
  enabled: translation_query_enabled(text_data_present_, project, selected_text_levels)
});

export const trans_lang_data_q_options = (
  lang_id: number,
  selected_text_levels: (number | null)[],
  project: ProjectState | null
) =>
  queryOptions({
    queryKey: QUERY_KEYS.trans_lang_data(lang_id, selected_text_levels, project),
    queryFn: () => get_translations(selected_text_levels, lang_id, project!),
    enabled: project !== null
  });

export const trans_en_data_q_options = (
  selected_text_levels: (number | null)[],
  project: ProjectState | null
) => trans_lang_data_q_options(lang_list_obj.English, selected_text_levels, project);

export const active_trans_lang_data_q_options = (
  lang_id: number,
  selected_text_levels: (number | null)[],
  project: ProjectState | null,
  text_data_present_: boolean,
  editing_mode_: editing_mode_type
) => ({
  ...trans_lang_data_q_options(lang_id, selected_text_levels, project),
  enabled:
    translation_query_enabled(text_data_present_, project, selected_text_levels) && lang_id !== 0,
  ...pin_query_while_editing(editing_mode_)
});

export const active_trans_en_data_q_options = (
  selected_text_levels: (number | null)[],
  project: ProjectState | null,
  text_data_present_: boolean,
  editing_mode_: editing_mode_type
) =>
  active_trans_lang_data_q_options(
    lang_list_obj.English,
    selected_text_levels,
    project,
    text_data_present_,
    editing_mode_
  );

export const trans_slot_data_q_options = (
  slot: 0 | 1,
  selected_translation_lang_ids: (number | null)[],
  selected_text_levels: (number | null)[],
  project: ProjectState | null,
  text_data_present_: boolean,
  editing_mode_: editing_mode_type
) => {
  const lang_id = selected_translation_lang_ids[slot];
  const pin_while_editing =
    slot === 0
      ? editing_mode_ === '1st_lang' || editing_mode_ === 'text'
      : editing_mode_ === '2nd_lang' || editing_mode_ === 'text';
  return {
    ...trans_lang_data_q_options(lang_id ?? -1, selected_text_levels, project),
    enabled:
      translation_query_enabled(text_data_present_, project, selected_text_levels) &&
      lang_id !== null,
    ...(pin_while_editing ? { staleTime: Infinity } : {})
  };
};

export const get_trans_lang_data_query_key = (
  trans_lang: number,
  selected_text_levels: (number | null)[],
  project: ProjectState | null
) => trans_lang_data_q_options(trans_lang, selected_text_levels, project).queryKey;

export const get_trans_slot_data_query_keys = (
  selected_translation_lang_ids: (number | null)[],
  selected_text_levels: (number | null)[],
  project: ProjectState | null
) =>
  [
    trans_lang_data_q_options(selected_translation_lang_ids[0] ?? -1, selected_text_levels, project)
      .queryKey,
    trans_lang_data_q_options(selected_translation_lang_ids[1] ?? -1, selected_text_levels, project)
      .queryKey
  ] as const;

export const prefetch_text_data = (
  selected_text_levels: (number | null)[],
  project: ProjectState
) => {
  if (!browser) return;
  return queryClient.prefetchQuery(text_data_q_options(selected_text_levels, project));
};

export async function get_translations(
  selected_text_levels: (number | null)[],
  lang_id: number,
  project: ProjectState
) {
  await delay(400);
  const data_map = await client.translation.get_translation.query({
    project_id: project.project_id,
    lang_id: lang_id,
    selected_text_levels
  });
  return data_map;
}

export const prefetch_translation_data = (
  selected_text_levels: (number | null)[],
  project: ProjectState,
  current_trans_lang: number
) => {
  if (!browser) return;
  if (!has_translation_query_path(selected_text_levels, project.levels)) return;
  const prefetches = [
    queryClient.prefetchQuery(
      trans_lang_data_q_options(lang_list_obj.English, selected_text_levels, project)
    )
  ];
  if (current_trans_lang !== 0 && current_trans_lang !== lang_list_obj.English) {
    prefetches.push(
      queryClient.prefetchQuery(
        trans_lang_data_q_options(current_trans_lang, selected_text_levels, project)
      )
    );
  }
  return Promise.all(prefetches);
};

export let english_edit_status = writable(false);

export let bulk_text_edit_status = writable(false);
export let bulk_text_data = writable('');

export const get_total_count = (
  selected_text_levels: (number | null)[],
  project_map: recursive_list_type | undefined,
  levels: number
) => {
  if (!project_map) return 0;

  if (levels === 1) return project_map?.info?.type === 'shloka' ? (project_map.info.total ?? 0) : 0;

  const path_params = get_dynamic_path_params(selected_text_levels, levels);
  if (path_params.length === 0) return 0;
  const node = get_node_at_path(project_map, path_params);
  if (!node || node.info.type !== 'shloka') return 0;
  return node.info.total ?? 0;
};

export const get_last_level_name = (
  selected_text_levels: (number | null)[],
  project_map: recursive_list_type | undefined,
  levels: number
) => {
  if (!project_map) return '';

  if (levels === 1) {
    return project_map?.name_dev ?? '';
  }
  const path_params = get_dynamic_path_params(selected_text_levels, levels);
  if (path_params.length > 0) {
    const node = get_node_at_path(project_map, path_params);
    return node?.name_dev ?? '';
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
