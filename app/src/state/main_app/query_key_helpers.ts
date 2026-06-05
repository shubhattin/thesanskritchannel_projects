export const get_dynamic_path_params = (
  selected_text_levels: (number | null)[],
  project_levels: number
) => {
  const params = selected_text_levels.slice(0, project_levels - 1).reverse();
  while (params.length && params[params.length - 1] == null) params.pop();
  if (params.some((v) => v == null)) return [];
  return params as number[];
};

export const get_normalized_selected_text_levels = (
  selected_text_levels: (number | null)[],
  project_levels: number
) => {
  if (project_levels <= 1) return [] as (number | null)[];
  const path_params = get_dynamic_path_params(selected_text_levels, project_levels);
  const normalized = Array.from({ length: project_levels - 1 }, () => null as number | null);
  const reversed = [...path_params].reverse();
  for (let i = 0; i < reversed.length; i++) normalized[i] = reversed[i]!;
  return normalized;
};

export const build_trans_lang_data_query_key = (
  project_id: number,
  lang_id: number,
  selected_text_levels: (number | null)[],
  project_levels: number
) => {
  return [
    'trans',
    project_id,
    lang_id,
    ...get_dynamic_path_params(selected_text_levels, project_levels)
  ] as const;
};

export const build_content_session_scope = (
  project_id: number | null,
  selected_text_levels: (number | null)[],
  project_levels: number
) =>
  `${project_id ?? ''}:${get_dynamic_path_params(selected_text_levels, project_levels).join(':')}`;
