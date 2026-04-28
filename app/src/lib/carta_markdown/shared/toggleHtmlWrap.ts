import type { InputEnhancer } from 'carta-md';

/** Toggle wrapping the selection in paired HTML start/end tags (e.g. `<u>` / `<lipi>`). */
export function toggleHtmlTagWrap(input: InputEnhancer, open: string, close: string) {
  const { start, end } = input.getSelection();
  const before = input.textarea.value.slice(start - open.length, start);
  const after = input.textarea.value.slice(end, end + close.length);
  if (before === open && after === close) {
    input.removeAt(end, close.length);
    input.removeAt(start - open.length, open.length);
    input.textarea.setSelectionRange(start - open.length, end - open.length);
  } else {
    input.insertAt(end, close);
    input.insertAt(start, open);
    input.textarea.setSelectionRange(start + open.length, end + open.length);
  }
}
