import { generateRandomAlphanumeric } from '~/tools/kry';

/** Explicit sentinel so null path segments stay distinct from 0 / empty. */
const NULL_PATH_SENTINEL = '_';

const encode_path_segment = (segment: number | null) =>
  segment === null ? NULL_PATH_SENTINEL : String(segment);

const decode_path_segment = (segment: string): number | null => {
  if (segment === NULL_PATH_SENTINEL) return null;
  return Number(segment);
};

const encode_path = (path_params: readonly (number | null)[]) =>
  path_params.map(encode_path_segment).join('/');

const decode_path = (path_raw: string): (number | null)[] =>
  path_raw === '' ? [] : path_raw.split('/').map(decode_path_segment);

/** `shloka-image:{project}-{path}/{segments}-{index}-{4-char}` — suffix keeps retries unique. */
export const getShlokaImageBatchCustomId = (
  project_id: number,
  path_params: readonly (number | null)[],
  index: number
) => {
  const suffix = generateRandomAlphanumeric(4);
  return `shloka-image:${project_id}-${encode_path(path_params)}-${index}-${suffix}`;
};

export const isShlokaImageBatchCustomId = (custom_id: string) =>
  custom_id.startsWith('shloka-image:');

export const parseShlokaImageBatchCustomId = (custom_id: string) => {
  const match = /^shloka-image:(\d+)-(.*)-(\d+)-([A-Za-z0-9]{4})$/.exec(custom_id);
  if (!match) return null;
  return {
    project_id: Number.parseInt(match[1]!, 10),
    path_params: decode_path(match[2]!),
    index: Number.parseInt(match[3]!, 10),
    suffix: match[4]!
  };
};

/**
 * `text-translation:{project}-{path/segments}-{4-char}`
 * Path segments are slash-joined (same as image batches). Lang stays in metadata only.
 * Examples: `text-translation:3-6-98oU`, `text-translation:3-2/5-98oU`
 */
export const getTextTranslationBatchCustomId = (
  project_id: number,
  path_params: readonly (number | null)[]
) => {
  const suffix = generateRandomAlphanumeric(4);
  return `text-translation:${project_id}-${encode_path(path_params)}-${suffix}`;
};

export const isTextTranslationBatchCustomId = (custom_id: string) =>
  custom_id.startsWith('text-translation:');

export const parseTextTranslationBatchCustomId = (custom_id: string) => {
  const match = /^text-translation:(\d+)-(.*)-([A-Za-z0-9]{4})$/.exec(custom_id);
  if (!match) return null;
  return {
    project_id: Number.parseInt(match[1]!, 10),
    path_params: decode_path(match[2]!),
    suffix: match[3]!
  };
};
