import { transliterate_node } from 'lipilekhika/node';
import { get_script_from_id, type script_list_type } from '@app/state/lang_list';
import { CACHE, NO_CACHE_PARAMS } from '@app/effect/cache_loaders';
import { renderLekhaMarkdownToHtml } from '@app/lib/carta_markdown/markdown';
import { DEFAULT_SCRIPT_ID } from '$lib/cookies';
import { runServerEffect, runServerEffectOr } from '~/effect/site_runtime';
import { maybe_transliterate_list } from '$lib/main_text/script-display.server';
import { lekha_has_script_selector } from './lekha-script-indicator';
import { transliterate_lekha_fields } from './transliterate-lekha-fields';

function script_from_id(script_id: number): script_list_type {
  return get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID) ?? 'Devanagari';
}

async function load_listed_lekhas() {
  const rows = await runServerEffectOr(CACHE.site_lekha_list.get(NO_CACHE_PARAMS), []);
  return rows.filter((row) => row.draft !== true);
}

export async function load_lekha_list(script_id: number) {
  const rows = await load_listed_lekhas();
  return transliterate_lekha_fields(rows, script_id, maybe_transliterate_list);
}

export async function load_latest_lekhas(script_id: number, limit = 5) {
  const rows = await load_listed_lekhas();
  return transliterate_lekha_fields(rows.slice(0, limit), script_id, maybe_transliterate_list);
}

export type LekhaEntryPayload = {
  title: string;
  /** Null when the viewing script is Devanagari or the title was not transliterated. */
  title_transliterated: string | null;
  description: string | null;
  description_transliterated: string | null;
  published_at: Date | string | null;
  content: string;
  tags: string[];
  has_script_indicator: boolean;
  /** HTML for current script (SSR). */
  html: string;
  /**
   * Devanagari-rendered HTML. Null when script_id is Devanagari (use `html` only —
   * avoid duplicating the payload).
   */
  html_base: string | null;
};

export async function load_lekha_entry(
  slug: string,
  script_id: number
): Promise<LekhaEntryPayload | null> {
  const row = await runServerEffect(CACHE.site_lekha_data.get({ url_slug: slug }));
  if (!row || row.draft || !row.listed) return null;

  const script = script_from_id(script_id);
  const render = (target: script_list_type) =>
    renderLekhaMarkdownToHtml(row.content, {
      script: target,
      lipiTransliterator: transliterate_node,
      autoTransliterateContent: row.auto_transliterate_content
    });

  const [fields, html, html_base] = await Promise.all([
    transliterate_lekha_fields([row], script_id, maybe_transliterate_list),
    render(script),
    script_id === DEFAULT_SCRIPT_ID ? Promise.resolve(null) : render('Devanagari')
  ]);

  const field = fields[0];
  if (!field) return null;

  return {
    title: row.title,
    title_transliterated: field.title_transliterated,
    description: row.description ?? null,
    description_transliterated: field.description_transliterated,
    published_at: row.published_at ?? null,
    content: row.content,
    tags: row.tags ?? [],
    has_script_indicator: lekha_has_script_selector({
      title: row.title,
      description: row.description,
      content: row.content,
      auto_transliterate_title: row.auto_transliterate_title,
      auto_transliterate_description: row.auto_transliterate_description,
      auto_transliterate_content: row.auto_transliterate_content
    }),
    html,
    html_base
  };
}
