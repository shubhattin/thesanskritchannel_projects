import type { Icon, Plugin } from 'carta-md';
import { defaultIcons } from 'carta-md-default-icons';
import { code } from '@cartamd/plugin-code';
import { lipiToolbarIcon } from './lipi/lipiPlugin';
import { shlokaToolbarIcon } from './shloka/shlokaPlugin';
import { lipiShlokaToolbarIcon } from './lipi_shloka/lipiShlokaPlugin';
import { lekhaUnderlinePlugin } from './underline/lekhaUnderlinePlugin';
import { lekhaTableToolbarPlugin } from './table/lekhaTableToolbarPlugin';
import { lekhaVideoToolbarPlugin } from './video/lekhaVideoToolbarPlugin';
import { LEKHA_SHIKI_DUAL } from './code/lekhaShikiThemes';

const DISABLED_DEFAULT_ICONS = new Set(['strikethrough', 'taskList']);

/**
 * Rebuilds the base Carta icons (with some disabled), inserts **Lipi** immediately after **Italic**,
 * then appends **Underline** and **video** (YouTube snippet) controls. **`code`** highlighting comes from
 * `@cartamd/plugin-code` (paired with `.theme` / `shikiOptions` on `Carta`). Requires `new Carta({ disableIcons: true, … })`
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
      out.push(lipiShlokaToolbarIcon);
    }
  }
  return out;
}

/**
 * Lekha editor Carta extensions: Shiki code blocks + full toolbar + underline + GFM table + YouTube; Lipi/Shloka after Italic.
 */
export function getLekhaCartaExtensions(): Plugin[] {
  return [
    code({ theme: LEKHA_SHIKI_DUAL }),
    { icons: lekhaOrderedBaseIcons() },
    lekhaUnderlinePlugin(),
    lekhaTableToolbarPlugin(),
    lekhaVideoToolbarPlugin()
  ];
}
