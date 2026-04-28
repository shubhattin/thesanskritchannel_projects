import type { Icon, InputEnhancer } from 'carta-md';
import LipiShlokaToolbarIcon from './LipiShlokaToolbarIcon.svelte';
import { toggleHtmlTagWrap } from '../shared/toggleHtmlWrap';

/** Newlines inside the block (after `<lipi-shloka>`, before `</lipi-shloka>`). */
const LIPI_SHLOKA_OPEN = '<lipi-shloka>\n';
const LIPI_SHLOKA_CLOSE = '\n</lipi-shloka>';

function toggleLipiShlokaWrap(input: InputEnhancer) {
  toggleHtmlTagWrap(input, LIPI_SHLOKA_OPEN, LIPI_SHLOKA_CLOSE);
}

/**
 * Combined lipi + verse block; `renderLekhaMarkdownToHtml` expands to `<lipi>` + `<shloka>` — not on save.
 * After **Shloka** in `lekhaOrderedBaseIcons()`.
 */
export const lipiShlokaToolbarIcon: Icon = {
  id: 'lipi-shloka',
  label: 'lipi + shloka block',
  component: LipiShlokaToolbarIcon,
  action: (input) => toggleLipiShlokaWrap(input)
};
