import type { MediaLinkRow } from '@app/effect/cache_loaders';
import type { shloka_list_type } from '@app/state/data_types';
import type { resolved_text_route_type } from '~/utils/text-routes';

export type ChildRouteItem = {
  index: number;
  href: string;
  name_dev: string;
  is_leaf: boolean;
  is_disabled: boolean;
};

export type TextRouteLoadData = {
  resolved: resolved_text_route_type;
  child_items: ChildRouteItem[];
  /** Base Devanagari shloka list (null on list nodes). */
  text: shloka_list_type | null;
  /**
   * Pre-transliterated shloka strings for SSR. Null when script is Devanagari
   * (use `text[].text`) or when there is no text.
   */
  transliterated_text: string[] | null;
  /** Path names in Devanagari. */
  path_names_dev: string[];
  /** Pre-transliterated path names; null when script is Devanagari. */
  transliterated_path_names: string[] | null;
  /** Child names pre-transliterated; null when script is Devanagari. */
  transliterated_child_names: string[] | null;
  /**
   * Prev/next sibling + root-map parent names for the current script.
   * Keys are Devanagari `name_dev`. Null when script is Devanagari or none needed.
   */
  transliterated_nav_names: Record<string, string> | null;
  available_lang_ids: number[];
  /** Effective lang after availability check. */
  effective_lang_id: number;
  /** Translation map as plain object for JSON; null if none. */
  translation: Record<number, string> | null;
  media_links: MediaLinkRow[];
};
