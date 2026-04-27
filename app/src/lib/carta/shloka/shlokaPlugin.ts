import type { Icon, InputEnhancer } from 'carta-md';
import ShlokaToolbarIcon from './ShlokaToolbarIcon.svelte';

/** Newlines only inside the tags (after `<shloka>`, before `</shloka>`), not outside the block. */
const SHLOKA_OPEN = '<shloka>\n';
const SHLOKA_CLOSE = '\n</shloka>';

function toggleShlokaTagWrap(input: InputEnhancer) {
  const { start, end } = input.getSelection();
  const before = input.textarea.value.slice(start - SHLOKA_OPEN.length, start);
  const after = input.textarea.value.slice(end, end + SHLOKA_CLOSE.length);
  if (before === SHLOKA_OPEN && after === SHLOKA_CLOSE) {
    input.removeAt(end, SHLOKA_CLOSE.length);
    input.removeAt(start - SHLOKA_OPEN.length, SHLOKA_OPEN.length);
    input.textarea.setSelectionRange(
      start - SHLOKA_OPEN.length,
      end - SHLOKA_OPEN.length
    );
  } else {
    input.insertAt(end, SHLOKA_CLOSE);
    input.insertAt(start, SHLOKA_OPEN);
    const o = SHLOKA_OPEN.length;
    input.textarea.setSelectionRange(start + o, end + o);
  }
}

/**
 * Multiline verse: `renderLekhaMarkdownToHtml` turns line breaks into `&lt;br/&gt;` inside the block.
 * After **Lipi** in `getLekhaCartaExtensions()`.
 */
export const shlokaToolbarIcon: Icon = {
  id: 'shloka',
  label: 'multiline shloka',
  component: ShlokaToolbarIcon,
  action: (input) => toggleShlokaTagWrap(input)
};
