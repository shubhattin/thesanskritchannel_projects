import type { recursive_list_type } from '../state/data_types';
import { get_path_params } from '../state/project_list';
import { build_project_path } from '../utils/project_site_paths';

export const get_main_site_origin = () =>
  (typeof import.meta.env.VITE_MAIN_SITE_URL === 'string'
    ? import.meta.env.VITE_MAIN_SITE_URL.trim()
    : ''
  ).replace(/\/+$/, '');

export const build_main_site_project_link = ({
  project_key,
  map,
  selected_text_levels = null,
  levels = 0
}: {
  project_key: string;
  map: recursive_list_type | null | undefined;
  selected_text_levels?: (number | null)[] | null;
  levels?: number;
}) => {
  const origin = get_main_site_origin();
  if (!origin || !map) return null;

  const path_params =
    selected_text_levels && levels > 0 ? get_path_params(selected_text_levels, levels) : [];

  const path = build_project_path(project_key, map, path_params);
  if (!path) return null;

  return { href: `${origin}${path}`, path };
};

export const build_main_site_project_href = (
  args: Parameters<typeof build_main_site_project_link>[0]
) => build_main_site_project_link(args)?.href ?? null;
