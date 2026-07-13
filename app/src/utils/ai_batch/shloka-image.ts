import { generateRandomAlphanumeric } from '~/tools/kry';

/** `shloka-image:{project}-{path}/{segments}-{index}-{4-char}` — suffix keeps retries unique. */
export const getShlokaImageBatchCustomId = (
  project_id: number,
  path_params: readonly (number | null)[],
  index: number
) => {
  const suffix = generateRandomAlphanumeric(4);
  return `shloka-image:${project_id}-${path_params.join('/')}-${index}-${suffix}`;
};

export const isShlokaImageBatchCustomId = (custom_id: string) =>
  custom_id.startsWith('shloka-image:');

export const parseShlokaImageBatchCustomId = (custom_id: string) => {
  const match = /^shloka-image:(\d+)-(.*)-(\d+)-([A-Za-z0-9]{4})$/.exec(custom_id);
  if (!match) return null;
  const path_raw = match[2]!;
  return {
    project_id: Number.parseInt(match[1]!, 10),
    path_params: path_raw === '' ? [] : path_raw.split('/').map(Number),
    index: Number.parseInt(match[3]!, 10),
    suffix: match[4]!
  };
};
