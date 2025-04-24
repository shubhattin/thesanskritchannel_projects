import {
  get_project_from_key,
  get_project_info_from_key,
  type project_keys_type
} from '~/state/project_list';
import { REDIS_CACHE_KEYS } from '~/db/redis_shared';
import simpleGit from 'simple-git';

async function main() {
  const git = simpleGit({ baseDir: process.cwd() });
  const status = await git.status();
  const files = new Set([
    ...status.modified,
    ...status.not_added,
    ...status.created,
    ...status.staged
  ]);

  const invalidation_keys: string[] = [];

  files.forEach((file) => {
    if (!/^data\/\d(\d)?\. \S+$/.test(file)) return;
    if (!file.endsWith('.json')) return;
    const project_key = file.split('/')[1].split('. ')[1] as project_keys_type;
    const project_info = get_project_info_from_key(project_key);
    const project_id = get_project_from_key(project_key).id;
    const { levels } = project_info;
    if (levels === 1) {
      if (file.endsWith('data.json')) {
        invalidation_keys.push(REDIS_CACHE_KEYS.text_data(project_id, []));
      }
      return;
    }
    const folder_container_name = file.split('/')[2];
    if (folder_container_name !== 'data') return;
    const path_params = file
      .replace(/\.json$/, '')
      .split('/')
      .splice(3)
      .map((v) => Number(v));
    invalidation_keys.push(REDIS_CACHE_KEYS.text_data(project_id, path_params));
  });
  console.log('Files changed:', invalidation_keys);
}

main().catch(console.error);
