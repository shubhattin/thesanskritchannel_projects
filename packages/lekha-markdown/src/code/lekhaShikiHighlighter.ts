import { createHighlighter } from 'shiki';
import type { Highlighter } from 'shiki';

import { LEKHA_SHIKI_LANGS } from './lekhaShikiLangs';
import { LEKHA_SHIKI_DUAL } from './lekhaShikiThemes';

/** Single highlighter for SSR + browser preview (`renderLekhaMarkdownToHtml`). */
let highlighterPromise: Promise<Highlighter> | undefined;

export function getLekhaShikiHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [LEKHA_SHIKI_DUAL.light, LEKHA_SHIKI_DUAL.dark],
      langs: [...LEKHA_SHIKI_LANGS]
    });
  }
  return highlighterPromise;
}
