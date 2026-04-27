import type { Plugin } from 'carta-md';
import { createWrapTagPlugin } from './createWrapTagPlugin';
import UnderlineToolbarIcon from './UnderlineToolbarIcon.svelte';

export function lekhaUnderlinePlugin(): Plugin {
  return createWrapTagPlugin({
    id: 'underline',
    label: 'Underline',
    component: UnderlineToolbarIcon,
    openTag: '<u>',
    closeTag: '</u>',
    shortcut: ['control', 'u']
  });
}
