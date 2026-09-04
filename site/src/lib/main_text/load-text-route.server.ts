import { CACHE } from '@app/effect/cache_loaders';
import {
  get_child_route_items,
  get_selected_text_levels_from_path_params,
  resolve_text_route
} from '~/utils/text-routes';
import { runServerEffectNullable, runServerEffectOr } from '~/effect/site_runtime';
import { NONE_LANG_ID } from '$lib/cookies';
import { maybe_transliterate_list } from './script-display.server';
import { error, redirect } from '@sveltejs/kit';
import type { TextRouteLoadData } from './text-route-types';
export type { ChildRouteItem, TextRouteLoadData } from './text-route-types';

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

  const [transliterated_text, transliterated_path_names, transliterated_child_names] =
    await Promise.all([
      maybe_transliterate_list(text_strings, opts.script_id),
      maybe_transliterate_list(path_names_dev, opts.script_id),
      maybe_transliterate_list(child_name_devs, opts.script_id)
    ]);

  return {
    resolved,
    child_items,
    text,
    transliterated_text,
    path_names_dev,
    transliterated_path_names,
    transliterated_child_names,
    available_lang_ids,
    effective_lang_id,
    translation,
    media_links
  };
}
