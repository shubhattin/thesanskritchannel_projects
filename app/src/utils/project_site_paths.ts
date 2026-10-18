import type { recursive_list_type } from '../state/data_types';
import { get_list_name_for_path_param_index, get_node_at_path } from '../state/project_list';
import { UID_LENGTH } from '../db/uid';

const NUMERIC_SEGMENT_RE = /^[1-9]\d*$/;
const PRETTY_SEGMENT_RE = /^(?<levelSlug>.+)-(?<num>[1-9]\d*)$/;

export const normalize_level_name_for_url = (name: string) =>
  // De-accent for stable URL slugs.
  // Example: "Bhāga" -> "bhaga" (not "bh-ga").
  name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const build_pretty_route_segment = (level_name: string, num: number) =>
  `${normalize_level_name_for_url(level_name)}-${num}`;

export const parse_pretty_route_segment = (segment: string) => {
  const match = PRETTY_SEGMENT_RE.exec(segment);
  if (!match?.groups) return null;
  const num = Number(match.groups.num);
  if (!Number.isInteger(num) || num < 1) return null;
  return {
    level_slug: match.groups.levelSlug,
    num
  };
};

export const is_numeric_route = (segments: string[]) =>
  segments.length > 0 && segments.every((segment) => NUMERIC_SEGMENT_RE.test(segment));

export const get_pretty_segments_for_path_params = (
  map: recursive_list_type,
  path_params: number[]
) => {
  const segments: string[] = [];
  for (let i = 0; i < path_params.length; i++) {
    const num = path_params[i]!;
    const level_name = get_list_name_for_path_param_index(map, path_params, i, 'Level');
    const parent_node = i === 0 ? map : get_node_at_path(map, path_params.slice(0, i));
    if (!parent_node || parent_node.info.type !== 'list') return null;
    const list = parent_node.list ?? [];
    if (!(num >= 1 && num <= list.length)) return null;
    segments.push(build_pretty_route_segment(level_name, num));
  }
  return segments;
};

export const build_project_path = (
  project_key: string,
  map: recursive_list_type,
  path_params: number[]
) => {
  const segments = get_pretty_segments_for_path_params(map, path_params);
  if (!segments) return null;
  return segments.length === 0 ? `/${project_key}` : `/${project_key}/${segments.join('/')}`;
};

/** nano-id default URL-safe alphabet (`A-Za-z0-9_-`); uids may themselves contain `-`. */
const UID_SUFFIX_RE = /^[A-Za-z0-9_-]+$/;

export type split_key_uid_result = { key: string; uid: string };

/**
 * Splits a `{project_key}-{uid}` shared-URL key. Since uids are always exactly `UID_LENGTH`
 * chars, the uid (if present) must be the final 5 chars preceded by a dash — no ambiguity
 * with dashes inside the key or inside the uid itself. `is_key_uid_match` must confirm the
 * key exists AND the uid matches it (keeps this pure/testable; callers use the registry).
 */
export const split_project_key_uid = (
  raw_key: string,
  is_key_uid_match: (key: string, uid: string) => boolean
): split_key_uid_result | null => {
  if (raw_key.length <= UID_LENGTH + 1) return null;
  if (raw_key[raw_key.length - UID_LENGTH - 1] !== '-') return null;
  const uid = raw_key.slice(-UID_LENGTH);
  if (!UID_SUFFIX_RE.test(uid)) return null;
  const key = raw_key.slice(0, -UID_LENGTH - 1);
  if (!key || !is_key_uid_match(key, uid)) return null;
  return { key, uid };
};

export type text_route_link_key_input = {
  project_key: string;
  uid: string | null;
  /** Served via the `{key}-{uid}` shared-URL form. */
  preview_via_uid: boolean;
  listed: boolean;
};

/**
 * Key to use when building in-site links: unlisted projects served via the uid form keep
 * navigating within `{key}-{uid}` (the canonical key alone would 404); everything else
 * links canonically.
 */
export const resolve_text_route_link_key = (input: text_route_link_key_input): string =>
  input.preview_via_uid && !input.listed && input.uid
    ? `${input.project_key}-${input.uid}`
    : input.project_key;
export type text_route_redirect_input = {
  /** Key resolved via `project_redirects` (old key → canonical). */
  was_redirect: boolean;
  /** Key resolved via the `{key}-{uid}` shared-URL form. */
  preview_via_uid: boolean;
  listed: boolean;
  numeric_route: boolean;
  canonical_path: string;
};

/**
 * Decides the 301 target for a resolved text route:
 * - uid-form + listed project → canonical (the uid form only exists for sharing unlisted work)
 * - uid-form + unlisted project → serve as-is (no redirect; this IS the share URL)
 * - numeric routes always canonicalize, except the unlisted uid-form case above
 */
export const decide_text_route_redirect = (input: text_route_redirect_input): string | null => {
  if (input.numeric_route) {
    return input.preview_via_uid && !input.listed ? null : input.canonical_path;
  }
  if (input.was_redirect) return input.canonical_path;
  if (input.preview_via_uid && input.listed) return input.canonical_path;
  return null;
};
