export const getShlokaImageBatchCustomId = (
  project_id: number,
  path_params: (number | null)[],
  index: number
) => {
  return `shloka-image:${project_id}-${path_params.join('/')}-${index}`;
};

export const parseShlokaImageBatchCustomId = (custom_id: string) => {
  const match = /^shloka-image:(\d+)-(.+)-(\d+)$/.exec(custom_id);
  if (!match) return null;
  return {
    project_id: Number.parseInt(match[1], 10),
    path_params: match[2].split('/').map(Number),
    index: Number.parseInt(match[3], 10)
  };
};
