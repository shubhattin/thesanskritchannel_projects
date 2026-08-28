import type { media_list_type } from '~/db/schema';

export const MEDIA_TYPE_LIST = {
  audio: 'Audio',
  video: 'Video',
  pdf: ' PDF',
  text: 'Text'
} satisfies Record<media_list_type, string>;

export type { media_list_type };
