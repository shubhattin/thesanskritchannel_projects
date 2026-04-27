import type { Icon, Plugin } from 'carta-md';
import { video } from 'carta-plugin-video';
import { defaultIcons } from 'carta-md-default-icons';
import { lipiToolbarIcon } from './lipiPlugin';
import { lekhaUnderlinePlugin } from './lekhaUnderlinePlugin';

const DISABLED_DEFAULT_ICONS = new Set(['strikethrough', 'code', 'taskList']);

/**
 * Rebuilds the base Carta icons (with some disabled), inserts **Lipi** immediately after **Italic**,
 * then appends **Underline** and **carta-plugin-video** controls. Requires `new Carta({ disableIcons: true, … })`
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
    }
  }
  return out;
}

/**
 * Lekha editor Carta extensions: full toolbar + underline + YouTube/Vimeo, with Lipi after Italic.
 */
export function getLekhaCartaExtensions(): Plugin[] {
  return [
    { icons: lekhaOrderedBaseIcons() },
    lekhaUnderlinePlugin(),
    video()
  ];
}
