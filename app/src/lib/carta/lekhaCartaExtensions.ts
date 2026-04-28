import type { Icon, Plugin } from 'carta-md';
import { defaultIcons } from 'carta-md-default-icons';
import { lipiToolbarIcon } from './lipi/lipiPlugin';
import { shlokaToolbarIcon } from './shloka/shlokaPlugin';
import { lekhaUnderlinePlugin } from './underline/lekhaUnderlinePlugin';
import { lekhaTableToolbarPlugin } from './table/lekhaTableToolbarPlugin';
import { lekhaVideoToolbarPlugin } from './video/lekhaVideoToolbarPlugin';

const DISABLED_DEFAULT_ICONS = new Set(['strikethrough', 'code', 'taskList']);

/**
 * Rebuilds the base Carta icons (with some disabled), inserts **Lipi** immediately after **Italic**,
 * then appends **Underline** and **video** (YouTube snippet) controls. Requires `new Carta({ disableIcons: true, … })`
 * so only this ordering is used.
 */
function lekhaOrderedBaseIcons(): Icon[] {
  const out: Icon[] = [];
  for (const icon of defaultIcons) {
    if (DISABLED_DEFAULT_ICONS.has(icon.id)) {
      continue;
    }
    out.push(icon);
    if (icon.id === 'italic') {
      out.push(lipiToolbarIcon);
      out.push(shlokaToolbarIcon);
    }
  }
  return out;
}

/**
 * Lekha editor Carta extensions: full toolbar + underline + GFM table snippet + YouTube snippet; Lipi then Shloka after Italic.
 */
export function getLekhaCartaExtensions(): Plugin[] {
  return [
    { icons: lekhaOrderedBaseIcons() },
    lekhaUnderlinePlugin(),
    lekhaTableToolbarPlugin(),
    lekhaVideoToolbarPlugin()
  ];
}
