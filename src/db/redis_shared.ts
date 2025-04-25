export const REDIS_CACHE_KEYS_CLIENT = {
  user_project_info: (user_id: string, project_id: number | '*') =>
    `user_project_info:${user_id}:${project_id}`,
  text_data: (project_id: number, path_params: (number | null)[]) =>
    `text_data:${project_id}:${path_params.join('/')}`,
  translation: (project_id: number, lang_id: number, path_params: (number | null)[]) =>
    `trans_data:${project_id}:${lang_id}:${path_params.join('/')}`,
  media_links: (project_id: number, path_params: (number | null)[]) =>
    `media_links:${project_id}:${path_params.join('/')}`
};
