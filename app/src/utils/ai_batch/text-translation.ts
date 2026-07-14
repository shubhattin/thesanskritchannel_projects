import { generateRandomAlphanumeric } from '~/tools/kry';

/** Explicit sentinel so null path segments stay distinct from 0 / empty. */
const NULL_PATH_SENTINEL = '_';

const encode_path_segment = (segment: number | null) =>
  segment === null ? NULL_PATH_SENTINEL : String(segment);

const decode_path_segment = (segment: string): number | null => {
  if (segment === NULL_PATH_SENTINEL) return null;
  return Number(segment);
};

/** `text-translation:{project}-{path}/{segments}-{lang_id}-{4-char}` — suffix keeps retries unique. */
export const getTextTranslationBatchCustomId = (
  project_id: number,
  path_params: readonly (number | null)[],
  lang_id: number
) => {
  const suffix = generateRandomAlphanumeric(4);
  const path = path_params.map(encode_path_segment).join('/');
  return `text-translation:${project_id}-${path}-${lang_id}-${suffix}`;
};

export const isTextTranslationBatchCustomId = (custom_id: string) =>
  custom_id.startsWith('text-translation:');

export const parseTextTranslationBatchCustomId = (custom_id: string) => {
  const match = /^text-translation:(\d+)-(.*)-(\d+)-([A-Za-z0-9]{4})$/.exec(custom_id);
  if (!match) return null;
  const path_raw = match[2]!;
  return {
    project_id: Number.parseInt(match[1]!, 10),
    path_params: path_raw === '' ? [] : path_raw.split('/').map(decode_path_segment),
    lang_id: Number.parseInt(match[3]!, 10),
    suffix: match[4]!
  };
};
