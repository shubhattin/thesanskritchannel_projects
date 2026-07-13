import { generateRandomAlphanumeric } from '~/tools/kry';

/** Explicit sentinel so null path segments stay distinct from 0 / empty. */
const NULL_PATH_SENTINEL = '_';

const encode_path_segment = (segment: number | null) =>
  segment === null ? NULL_PATH_SENTINEL : String(segment);

const decode_path_segment = (segment: string): number | null => {
  if (segment === NULL_PATH_SENTINEL) return null;
  return Number(segment);
};

/** `shloka-image:{project}-{path}/{segments}-{index}-{4-char}` — suffix keeps retries unique. */
export const getShlokaImageBatchCustomId = (
  project_id: number,
  path_params: readonly (number | null)[],
  index: number
) => {
  const suffix = generateRandomAlphanumeric(4);
  const path = path_params.map(encode_path_segment).join('/');
  return `shloka-image:${project_id}-${path}-${index}-${suffix}`;
};

export const isShlokaImageBatchCustomId = (custom_id: string) =>
  custom_id.startsWith('shloka-image:');

export const parseShlokaImageBatchCustomId = (custom_id: string) => {
  const match = /^shloka-image:(\d+)-(.*)-(\d+)-([A-Za-z0-9]{4})$/.exec(custom_id);
  if (!match) return null;
  const path_raw = match[2]!;
  return {
    project_id: Number.parseInt(match[1]!, 10),
    path_params: path_raw === '' ? [] : path_raw.split('/').map(decode_path_segment),
    index: Number.parseInt(match[3]!, 10),
    suffix: match[4]!
  };
};
