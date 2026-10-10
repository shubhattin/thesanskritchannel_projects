import { transliterate_node } from 'lipilekhika/node';
import { get_script_from_id, type script_list_type } from '@app/state/lang_list';
import { CACHE, NO_CACHE_PARAMS } from '@app/effect/cache_loaders';
import { renderLekhaMarkdownToHtml } from '@app/lib/carta_markdown/markdown';
import { DEFAULT_SCRIPT_ID } from '$lib/cookies';
import { runServerEffect, runServerEffectOr } from '~/effect/site_runtime';
import { maybe_transliterate_list } from '$lib/main_text/script-display.server';
import { lekha_has_script_selector } from './lekha-script-indicator';
import type { LekhaListPost } from './lekha-list';
import { transliterate_lekha_fields } from './transliterate-lekha-fields';

export type { LekhaListPost } from './lekha-list';

function script_from_id(script_id: number): script_list_type {
  return get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID) ?? 'Devanagari';
}

async function load_listed_lekhas() {
  const rows = await runServerEffectOr(CACHE.site_lekha_list.get(NO_CACHE_PARAMS), []);
  return rows.filter((row) => row.draft !== true);
}

type ListedLekha = Awaited<ReturnType<typeof load_listed_lekhas>>[number];

function to_list_post(
  row: ListedLekha & {
    title_transliterated: string | null;
    description_transliterated: string | null;
  }
): LekhaListPost {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    title_transliterated: row.title_transliterated,
    description_transliterated: row.description_transliterated,
    auto_transliterate_title: row.auto_transliterate_title,
    auto_transliterate_description: row.auto_transliterate_description,
    tags: row.tags ?? [],
    url_slug: row.url_slug,
    published_at: row.published_at ?? null
  };
}

export async function load_lekha_list(script_id: number) {
  const rows = await load_listed_lekhas();
  const fields = await transliterate_lekha_fields(rows, script_id, maybe_transliterate_list);
  return fields.map(to_list_post);
}

export async function load_latest_lekhas(script_id: number, limit = 5) {
  const rows = await load_listed_lekhas();
  const fields = await transliterate_lekha_fields(
    rows.slice(0, limit),
    script_id,
    maybe_transliterate_list
  );
  return fields.map(to_list_post);
}

export type LekhaEntryPayload = {
  /** Display title for the viewing script (already transliterated when needed). */
  title: string;
  description: string | null;
  /** True when `title` is in the viewing script rather than stored Devanagari. */
  title_in_script: boolean;
  description_in_script: boolean;
  published_at: Date | string | null;
  tags: string[];
  has_script_indicator: boolean;
  /** HTML rendered for the viewing script. */
  html: string;
};

export async function load_lekha_entry(
  slug: string,
  script_id: number
): Promise<LekhaEntryPayload | null> {
  const row = await runServerEffect(CACHE.site_lekha_data.get({ url_slug: slug }));
  if (!row || row.draft || !row.listed) return null;

  const script = script_from_id(script_id);
  const [fields, html] = await Promise.all([
    transliterate_lekha_fields([row], script_id, maybe_transliterate_list),
    renderLekhaMarkdownToHtml(row.content, {
      script,
      lipiTransliterator: transliterate_node,
      autoTransliterateContent: row.auto_transliterate_content
    })
  ]);

  const field = fields[0];
  if (!field) return null;

  return {
    title: field.title_transliterated ?? row.title,
    description: field.description_transliterated ?? row.description ?? null,
    title_in_script: field.title_transliterated !== null,
    description_in_script: field.description_transliterated !== null,
    published_at: row.published_at ?? null,
    tags: row.tags ?? [],
    has_script_indicator: lekha_has_script_selector({
      title: row.title,
      description: row.description,
      content: row.content,
      auto_transliterate_title: row.auto_transliterate_title,
      auto_transliterate_description: row.auto_transliterate_description,
      auto_transliterate_content: row.auto_transliterate_content
    }),
    html
  };
}
