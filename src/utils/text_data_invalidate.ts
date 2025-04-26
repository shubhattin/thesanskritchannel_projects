import {
  get_project_from_key,
  get_project_info_from_key,
  type project_keys_type
} from '~/state/project_list';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import simpleGit from 'simple-git';
import { z } from 'zod';
import chalk from 'chalk';
import { fetch_post } from '~/tools/fetch';
import dotenv from 'dotenv';
dotenv.config();

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
        invalidation_keys.push(REDIS_CACHE_KEYS_CLIENT.text_data(project_id, []));
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
    invalidation_keys.push(REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params));
  });
  if (invalidation_keys.length === 0) {
    console.log(chalk.bold(`✅ No cache to invalidate`));
    return;
  }
  if (process.argv.slice(2)[0] === '--only-check') {
    console.log(
      chalk.bold(
        `ℹ️  There are ${invalidation_keys.length} file caches that need to invalidated, make sure to invalidate cache ${chalk.blue('after commit')}`
      )
    );
    return;
  }

  if (process.argv.slice(2)[0] === '--verbose') {
    console.log(chalk.blue.bold('Keys to be Invalidated: '));
    invalidation_keys.forEach((key) => {
      console.log(key);
    });
  }

  const credential_schema = z.object({
    url: z.string().url(),
    key: z.string().uuid()
  });
  let credential: z.infer<typeof credential_schema> = null!;
  try {
    const cache_url_key = process.env.CACHE_URL_KEY!;
    credential = credential_schema.parse({
      url: cache_url_key.split(';')[0],
      key: cache_url_key.split(';')[1]
    });
  } catch (e) {
    console.error(chalk.bold(`⚠️  Missing ${chalk.blue('CACHE_URL_KEY')} env not defined`));
    console.error(`ℹ️  There are ${chalk.bold(invalidation_keys.length)} files to be invalidated`);
    return;
  }

  const req = await fetch_post(`${credential.url}/api/invalidate_cache`, {
    headers: {
      'X-Cache-Verify-Key': credential.key
    },
    json: {
      keys: invalidation_keys
    }
  });
  if (!req.ok) {
    console.error(await req.text());
    console.error(chalk.red.bold(`⚠️  Failed to invalidate cache`));
    console.error(`ℹ️  There are ${chalk.bold(invalidation_keys.length)} files to be invalidated`);
    return;
  }
  console.log(chalk.bold(`✅  Invalidated ${chalk.bold(invalidation_keys.length)} cache keys`));
}

main().catch(console.error);
