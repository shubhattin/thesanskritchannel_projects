import type { Icon, Plugin } from 'carta-md';
import TableToolbarIcon from './TableToolbarIcon.svelte';

/** GFM table; rendering uses `remarkGfm` in `renderLekhaMarkdownToHtml`. */
const TABLE_SNIPPET =
  '\n| Column 1 | Column 2 |\n| -------- | -------- |\n|          |          |\n';

const tableToolbarIcon: Icon = {
  id: 'table',
  label: 'Insert table',
  component: TableToolbarIcon,
  action: (input) => {
    const selection = input.getSelection();
    input.insertAt(selection.start, TABLE_SNIPPET);
    // Select first header placeholder "Column 1"
    const start = selection.start + 3;
    const len = 'Column 1'.length;
    input.textarea.setSelectionRange(start, start + len);
  }
};

export function lekhaTableToolbarPlugin(): Plugin {
  return { icons: [tableToolbarIcon] };
}
