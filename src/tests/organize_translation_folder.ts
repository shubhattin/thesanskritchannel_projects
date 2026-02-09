import * as fs from 'fs';
import js_yaml from 'js-yaml';
import { get_lang_from_id } from '~/state/lang_list';
import {
  get_project_from_id,
  get_project_info_from_id,
  type project_keys_type
} from '~/state/project_list';
import { TranslationSchemaZod } from '~/db/schema_zod';
import type { z } from 'zod';

// this file should be called from root dir
async function main() {
  const file = './src/db/scripts/backup/db_data.json';
  if (!fs.existsSync(file)) return;

  const translations = JSON.parse(fs.readFileSync(file, 'utf8'))['translation'] as z.infer<
    typeof TranslationSchemaZod
  >[];
  const trans_folder = './data/translations/';
  if (fs.existsSync(trans_folder)) fs.rmSync(trans_folder, { recursive: true });
  fs.mkdirSync(trans_folder);

  const data: {
    [project: string]: {
      [lang: string]: {
        [file_path: string]: Map<number, string>;
      };
    };
  } = {};

  for (let trans of translations) {
    const project_info = await get_project_info_from_id(trans.project_id);
    const project_key = project_info.key;
    const project_id = get_project_from_id(trans.project_id).id;
    const levels = project_info.levels;
    if (!data[project_key]) {
      data[project_key] = {};
      fs.mkdirSync(`./data/translations/${project_id}. ${project_key}`);
    }
    const lang_nm = get_lang_from_id(trans.lang_id);
    if (!data[project_key][lang_nm]) {
      data[project_key][lang_nm] = {};
      if (levels > 1) fs.mkdirSync(`./data/translations/${project_id}. ${project_key}/${lang_nm}`);
    }

    const path_params =
      trans.path && trans.path.trim().length
        ? trans.path
            .split(':')
            .map((v) => parseInt(v))
            .filter((v) => Number.isFinite(v))
        : [];

    const base = `./data/translations/${project_id}. ${project_key}`;
    const file_path = (() => {
      if (path_params.length === 0) return `${base}/${lang_nm}.yaml`;
      const last = path_params[path_params.length - 1];
      const dir_parts = path_params.slice(0, -1);
      const dir = dir_parts.length ? `/${dir_parts.join('/')}` : '';
      return `${base}/${lang_nm}${dir}/${last}.yaml`;
    })();

    // Ensure directories exist for this file_path.
    const folder = file_path.split('/').slice(0, -1).join('/');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    if (!data[project_key][lang_nm][file_path]) {
      data[project_key][lang_nm][file_path] = new Map();
    }
    data[project_key][lang_nm][file_path].set(trans.index, trans.text);
  }

  for (const project_key in data) {
    for (const lang in data[project_key]) {
      for (const file_path in data[project_key][lang]) {
        const trans_data = data[project_key][lang][file_path];
        fs.writeFileSync(file_path, js_yaml.dump(Object.fromEntries(trans_data), { indent: 2 }), {
          encoding: 'utf-8'
        });
      }
    }
  }
}
main();
