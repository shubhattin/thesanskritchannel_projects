import type { Icon } from 'carta-md';
import BrToolbarIcon from './BrToolbarIcon.svelte';

const BR_TAG = '<br/>';

/**
 * Insert `<br/>` at the cursor, replacing any selection. Place after **Bold** via
 * `lekhaOrderedBaseIcons()`.
 */
export const lekhaBrToolbarIcon: Icon = {
  id: 'br',
  label: 'Line break (Shift+Enter / Ctrl+Enter)',
  component: BrToolbarIcon,
  action: (input) => {
    const selection = input.getSelection();
    if (selection.end > selection.start) {
      input.removeAt(selection.start, selection.end - selection.start);
    }
    input.insertAt(selection.start, BR_TAG);
    const pos = selection.start + BR_TAG.length;
    input.textarea.setSelectionRange(pos, pos);
  }
};
