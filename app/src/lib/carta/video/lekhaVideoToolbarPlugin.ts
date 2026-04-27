import type { Icon, Plugin } from 'carta-md';
import VideoToolbarIcon from './VideoToolbarIcon.svelte';

/** Same insert snippet as the former `carta-plugin-video` toolbar. */
const videoToolbarIcon: Icon = {
  id: 'video',
  label: 'Embed YouTube video',
  component: VideoToolbarIcon,
  action: (input) => {
    const selection = input.getSelection();
    const videoTag = '\n@[youtube](youtubeVideoIdOrUrl)\n';
    input.insertAt(selection.start, videoTag);
    input.textarea.setSelectionRange(selection.start + 1, selection.start + videoTag.length - 1);
  }
};

/** Toolbar only (no remark step): HTML preview uses `cartaVideoEmbeds.ts`. */
export function lekhaVideoToolbarPlugin(): Plugin {
  return { icons: [videoToolbarIcon] };
}
