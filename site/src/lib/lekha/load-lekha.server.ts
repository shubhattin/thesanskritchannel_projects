import { transliterate } from 'lipilekhika';
import { get_script_from_id, type script_list_type } from '@app/state/lang_list';
import { CACHE, NO_CACHE_PARAMS } from '@app/effect/cache_loaders';
import { renderLekhaMarkdownToHtml } from '@app/lib/carta_markdown/markdown';
import { DEFAULT_SCRIPT_ID } from '$lib/cookies';
import { runServerEffect, runServerEffectOr } from '~/effect/site_runtime';

const SCRIPT_INDICATORS = ['<lipi>', '<lipi-shloka>'] as const;

function script_from_id(script_id: number): script_list_type {
  return get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID) ?? 'Devanagari';
}

export async function load_lekha_list() {
  const rows = await runServerEffectOr(CACHE.site_lekha_list.get(NO_CACHE_PARAMS), []);
  return rows.filter((row) => row.draft !== true);
}

export type LekhaEntryPayload = {
  title: string;
  description: string | null;
  published_at: Date | string | null;
  content: string;
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

  const has_script_indicator = SCRIPT_INDICATORS.some((indicator) =>
    row.content.includes(indicator)
  );

  const script = script_from_id(script_id);
  const html = await renderLekhaMarkdownToHtml(row.content, {
    script,
    lipiTransliterator: transliterate
  });

  let html_base: string | null = null;
  if (script_id !== DEFAULT_SCRIPT_ID) {
    html_base = await renderLekhaMarkdownToHtml(row.content, {
      script: 'Devanagari',
      lipiTransliterator: transliterate
    });
  }

  return {
    title: row.title,
    description: row.description ?? null,
    published_at: row.published_at ?? null,
    content: row.content,
    has_script_indicator,
    html,
    html_base
  };
}
