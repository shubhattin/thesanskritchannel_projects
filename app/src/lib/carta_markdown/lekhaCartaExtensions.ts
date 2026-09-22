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
import { LEKHA_CARTA_GRAMMAR_RULES } from './lekhaCartaGrammarRules';

const DISABLED_DEFAULT_ICONS = new Set(['strikethrough', 'taskList']);

/** Hover `title` hints for Carta default shortcuts that have toolbar buttons. */
const DEFAULT_ICON_SHORTCUT_HINTS: Readonly<Record<string, string>> = {
  bold: 'Ctrl+B',
  italic: 'Ctrl+I',
  code: 'Ctrl+E',
  link: 'Ctrl+K',
  quote: 'Ctrl+Shift+,'
};

function withShortcutHint(icon: Icon): Icon {
  const hint = DEFAULT_ICON_SHORTCUT_HINTS[icon.id];
  if (!hint) return icon;
  return { ...icon, label: `${icon.label} (${hint})` };
}

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
    out.push(withShortcutHint(icon));
    if (icon.id === 'italic') {
      out.push(lipiToolbarIcon);
      out.push(shlokaToolbarIcon);
      out.push(lipiShlokaToolbarIcon);
    }
  }
  return out;
}

/**
 * Same wrap actions as the toolbar buttons. Carta calls `preventDefault` on match, so these
 * override browser defaults (e.g. Ctrl+L location bar, Ctrl+J downloads) while the editor is focused.
 */
const LEKHA_LIPI_SHORTCUTS: NonNullable<Plugin['shortcuts']> = [
  {
    id: 'lipi',
    combination: new Set(['control', 'j']),
    action: lipiToolbarIcon.action
  },
  {
    id: 'lipi-shloka',
    combination: new Set(['control', 'l']),
    action: lipiShlokaToolbarIcon.action
  }
];

/**
 * Lekha editor Carta extensions: Shiki code blocks + full toolbar + underline + GFM table + YouTube; Lipi/Shloka after Italic.
 */
export function getLekhaCartaExtensions(): Plugin[] {
  return [
    { grammarRules: LEKHA_CARTA_GRAMMAR_RULES },
    code({ theme: LEKHA_SHIKI_DUAL }),
    { icons: lekhaOrderedBaseIcons(), shortcuts: LEKHA_LIPI_SHORTCUTS },
    lekhaUnderlinePlugin(),
    lekhaTableToolbarPlugin(),
    lekhaVideoToolbarPlugin()
  ];
}
