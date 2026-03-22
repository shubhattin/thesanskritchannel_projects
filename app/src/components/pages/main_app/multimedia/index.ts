import type { media_list_type } from '~/db/schema';

export const MEDIA_TYPE_LIST: Record<media_list_type, string> = {
  audio: 'Audio',
  video: 'Video',
  pdf: ' PDF',
  text: 'Text'
};

export type { media_list_type };
