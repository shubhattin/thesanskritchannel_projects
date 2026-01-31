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

type GroupedKey = {
  project_id: number;
  path_params_list: number[][];
};

async function main() {
  let files = new Set<string>();
  if (process.argv.slice(2).includes('--last-commit')) {
    console.log(chalk.yellow(`Checking for changes in the last commit...`));
    const changes = await getLastCommitChanges();
    files = new Set(changes.map((change) => change.filePath));
  } else {
    const git = simpleGit({ baseDir: process.cwd() });
    const status = await git.status();
    files = new Set([...status.modified, ...status.not_added, ...status.created, ...status.staged]);
  }

  const invalidation_keys = get_invalidation_keys_for_files(files);
  // console.log(invalidation_keys);
  if (invalidation_keys.length === 0) {
    console.log(chalk.bold(`✅ No cache to invalidate`));
    return;
  }
  if (process.argv.slice(2).includes('--only-check')) {
    console.log(
      chalk.bold(
        `ℹ️  There are ${invalidation_keys.length} file caches that need to invalidated, make sure to invalidate cache ${chalk.blue('after commit')}`
      )
    );
    return;
  }

  await invalidate_keys(invalidation_keys);
}

const get_invalidation_keys_for_files = (files: Set<string>) => {
  const invalidation_keys: {
    project_id: number;
    path_params: number[];
  }[] = [];

  files.forEach((file) => {
    if (!/^data\/\d(\d)?\. \S+$/.test(file)) return;
    if (!file.endsWith('.json')) return;
    const project_key = file.split('/')[1].split('. ')[1] as project_keys_type;
    const project_info = get_project_info_from_key(project_key);
    const project_id = get_project_from_key(project_key).id;
    const { levels } = project_info;
    if (levels === 1) {
      if (file.endsWith('data.json')) {
        invalidation_keys.push({ project_id, path_params: [] });
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
    invalidation_keys.push({ project_id, path_params });
  });

  const grouped_keys: GroupedKey[] = [];
  const all_project_ids = new Set<number>();
  for (const key of invalidation_keys) {
    all_project_ids.add(key.project_id);
  }
  for (const project_id of all_project_ids) {
    const path_params_list = invalidation_keys
      .filter((key) => key.project_id === project_id)
      .map((key) => key.path_params);
    grouped_keys.push({ project_id, path_params_list });
  }
  return grouped_keys;
};

const invalidate_keys = async (invalidation_keys: GroupedKey[]) => {
  if (process.argv.slice(2).includes('--verbose')) {
    console.log(chalk.blue.bold('Keys to be Invalidated: '));
    invalidation_keys.forEach((key) => {
      key.path_params_list.forEach((path_params) => {
        console.log(REDIS_CACHE_KEYS_CLIENT.text_data(key.project_id, path_params));
      });
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
};

main().catch(console.error);

type ChangeCode = 'A' | 'M' | 'C' | 'R' | 'T';

type ChangedFile = {
  code: ChangeCode;
  filePath: string;
};

async function getLastCommitChanges(): Promise<ChangedFile[]> {
  const git = simpleGit({ baseDir: process.cwd() });
  const log = await git.log({ maxCount: 1 });
  const latest = log.latest;
  if (!latest) return [];

  const raw = await git.raw(['diff-tree', '--no-commit-id', '--name-status', '-r', latest.hash]);

  const allowed = new Set<ChangeCode>(['A', 'M', 'C', 'R', 'T']);

  return raw
    .trim()
    .split('\n')
    .map((line) => {
      const [statusWithScore, ...paths] = line.split('\t');
      const code = statusWithScore.charAt(0) as ChangeCode;
      let filePath: string;

      // for copies/renames, the new path is the second element
      if ((code === 'C' || code === 'R') && paths.length >= 2) {
        filePath = paths[1];
      } else {
        // A, M, T: single path
        filePath = paths[0];
      }

      return { code, filePath };
    })
    .filter((f) => allowed.has(f.code));
}
