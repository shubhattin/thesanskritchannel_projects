import type { Icon } from 'carta-md';
import { createWrapTagIcon } from '../shared/createWrapTagPlugin';
import LipiToolbarIcon from './LipiToolbarIcon.svelte';

/**
 * Single toolbar action: wrap selection in `<lipi>…</lipi>` (Devanagari source for later transliteration).
 * Insert after the default **Italic** control via `getLekhaCartaExtensions()`.
 */
export const lipiToolbarIcon: Icon = createWrapTagIcon({
  id: 'lipi',
  component: LipiToolbarIcon,
  openTag: '<lipi>',
  closeTag: '</lipi>',
  /** Used as the button `title` and accessible name in Carta. */
  label: 'Write in Devanagari Lipi'
});
