import { CACHE } from '@app/effect/cache_loaders';
import { get_node_at_path } from '@app/state/project_list';
import {
  get_child_route_items,
  get_selected_text_levels_from_path_params,
  resolve_text_route,
  type resolved_text_route_type
} from '~/utils/text-routes';
import { runServerEffectNullable, runServerEffectOr } from '~/effect/site_runtime';
import { NONE_LANG_ID } from '$lib/cookies';
import { maybe_transliterate_list } from './script-display.server';
import { error, redirect } from '@sveltejs/kit';
import type { TextRouteLoadData } from './text-route-types';
export type { ChildRouteItem, TextRouteLoadData } from './text-route-types';

function collect_nav_name_devs(resolved: resolved_text_route_type): string[] {
  const names: string[] = [];
  if (resolved.node.info.type !== 'shloka' || resolved.path_params.length === 0) {
    return names;
  }

  const sibling_parent_path_params = resolved.path_params.slice(0, -1);
  const sibling_parent_node =
    sibling_parent_path_params.length === 0
      ? resolved.map
      : get_node_at_path(resolved.map, sibling_parent_path_params);
  const sibling_items =
    sibling_parent_node?.info.type === 'list' ? (sibling_parent_node.list ?? []) : [];
  const current = resolved.path_params.at(-1)!;

  if (current > 1) {
    const prev = sibling_items[current - 2]?.name_dev;
    if (prev) names.push(prev);
  }
  if (current < sibling_items.length) {
    const next = sibling_items[current]?.name_dev;
    if (next) names.push(next);
  }

  // One level deep: "Back to" parent is the map root name (not in path_names).
  if (resolved.path_params.length === 1 && resolved.map.name_dev) {
    names.push(resolved.map.name_dev);
  }

  return [...new Set(names)];
}

export async function load_text_route(opts: {
  key: string;
  slug: string[];
  pathname: string;
  lang_id: number;
  script_id: number;
}): Promise<TextRouteLoadData> {
  const resolved = await runServerEffectNullable(resolve_text_route(opts.key, opts.slug));
  if (!resolved) {
    error(404, 'Not found');
  }

  if (resolved.redirect_to && resolved.redirect_to !== opts.pathname) {
    redirect(301, resolved.redirect_to);
  }

  const available_lang_ids =
    resolved.node.info.type === 'shloka'
      ? await runServerEffectOr(
          CACHE.available_translation_langs.get({
            project_id: resolved.project_id,
            path_params: resolved.path_params
          }),
          []
        )
      : [];

  const effective_lang_id = available_lang_ids.includes(opts.lang_id) ? opts.lang_id : NONE_LANG_ID;

  const text =
    resolved.node.info.type === 'shloka'
      ? await runServerEffectOr(
          CACHE.text_data.get({
            key: resolved.project_key,
            path_params: resolved.path_params
          }),
          null
        )
      : null;

  const translation_map =
    resolved.node.info.type === 'shloka' && effective_lang_id !== NONE_LANG_ID
      ? await runServerEffectOr(
          CACHE.translation.get({
            project_id: resolved.project_id,
            lang_id: effective_lang_id,
            selected_text_levels: get_selected_text_levels_from_path_params(
              resolved.path_params,
              resolved.levels
            )
          }),
          null
        )
      : null;

  const translation: Record<number, string> | null = translation_map
    ? Object.fromEntries(translation_map)
    : null;

  const child_items = get_child_route_items(
    resolved.project_key,
    resolved.map,
    resolved.path_params,
    resolved.levels
  );

  const media_links = await runServerEffectOr(
    CACHE.media_links.get({
      project_id: resolved.project_id,
      path_params: resolved.path_params
    }),
    []
  );

  const path_names_dev = resolved.path_names;
  const text_strings = text?.map((item) => item.text) ?? [];
  const child_name_devs = child_items.map((item) => item.name_dev);
  const nav_name_devs = collect_nav_name_devs(resolved);

  const [transliterated_text, transliterated_path_names, transliterated_child_names, nav_names] =
    await Promise.all([
      maybe_transliterate_list(text_strings, opts.script_id),
      maybe_transliterate_list(path_names_dev, opts.script_id),
      maybe_transliterate_list(child_name_devs, opts.script_id),
      maybe_transliterate_list(nav_name_devs, opts.script_id)
    ]);

  const transliterated_nav_names: Record<string, string> | null = nav_names
    ? Object.fromEntries(nav_name_devs.map((dev, i) => [dev, nav_names[i] ?? dev]))
    : null;

  return {
    resolved,
    child_items,
    text,
    transliterated_text,
    path_names_dev,
    transliterated_path_names,
    transliterated_child_names,
    transliterated_nav_names,
    available_lang_ids,
    effective_lang_id,
    translation,
    media_links
  };
}
