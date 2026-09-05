import { createHighlighter } from 'shiki';
import type { Highlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

import { LEKHA_SHIKI_LANGS } from './lekhaShikiLangs';
import { LEKHA_SHIKI_DUAL } from './lekhaShikiThemes';

/**
 * Single highlighter for SSR + browser preview (`renderLekhaMarkdownToHtml`).
 *
 * Uses the JS regex engine (not Oniguruma WASM). Cloudflare Workers and Vite
 * SSR disallow `WebAssembly.instantiate` from binary ("Wasm code generation
 * disallowed by embedder"), which breaks default Shiki on lekha pages.
 */
let highlighterPromise: Promise<Highlighter> | undefined;

export function getLekhaShikiHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [LEKHA_SHIKI_DUAL.light, LEKHA_SHIKI_DUAL.dark],
      langs: [...LEKHA_SHIKI_LANGS],
      // forgiving: skip unsupported Oniguruma patterns instead of throwing
      engine: createJavaScriptRegexEngine({ forgiving: true })
    });
  }
  return highlighterPromise;
}
