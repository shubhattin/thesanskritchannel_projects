export const REDIS_CACHE_KEYS_CLIENT = {
  user_project_info: (user_id: string, project_id: number | '*') =>
    `user_project_info:${user_id}:${project_id}`,
  text_data: (project_id: number, path_params: (number | null)[] | string) => {
    let key = `text_data:${project_id}:`;
    if (Array.isArray(path_params)) return key + path_params.join('/');
    return key + path_params;
  },
  translation: (project_id: number, lang_id: number, path_params: (number | null)[] | string) => {
    let key = `trans_data:${project_id}:${lang_id}:`;
    if (Array.isArray(path_params)) return key + path_params.join('/');
    return key + path_params;
  },
  media_links: (project_id: number, path_params: (number | null)[] | string) => {
    let key = `media_links:${project_id}:`;
    if (Array.isArray(path_params)) return key + path_params.join('/');
    return key + path_params;
  }
};

export const REDIS_CACHES_ARGUMENTS_LIST: Record<keyof typeof REDIS_CACHE_KEYS_CLIENT, string[]> = {
  user_project_info: ['user_id', 'project_id'],
  text_data: ['project_id', 'path_params'],
  translation: ['project_id', 'lang_id', 'path_params'],
  media_links: ['project_id', 'path_params']
};
