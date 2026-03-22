import * as fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js_yaml from 'js-yaml';
import { get_lang_from_id } from '~/state/lang_list';
import { get_project_from_id, get_project_info_from_id } from '~/state/project_list';
import { TranslationSchemaZod } from '~/db/schema_zod';
import { z } from 'zod';

const backup_file = fileURLToPath(new URL('../db/scripts/backup/db_data.json', import.meta.url));
const translations_root = fileURLToPath(new URL('../../../data/translations/', import.meta.url));
const backup_schema = z
  .object({
    translations: TranslationSchemaZod.array().optional(),
    translation: TranslationSchemaZod.array().optional()
  })
  .transform((data) => data.translations ?? data.translation ?? []);

async function main() {
  if (!fs.existsSync(backup_file)) return;

  const translations = backup_schema.parse(JSON.parse(fs.readFileSync(backup_file, 'utf8')));
  if (fs.existsSync(translations_root)) fs.rmSync(translations_root, { recursive: true });
  fs.mkdirSync(translations_root, { recursive: true });

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
    const project_root = path.join(translations_root, `${project_id}. ${project_key}`);
    if (!data[project_key]) {
      data[project_key] = {};
      fs.mkdirSync(project_root, { recursive: true });
    }
    const lang_nm = get_lang_from_id(trans.lang_id);
    if (!data[project_key][lang_nm]) {
      data[project_key][lang_nm] = {};
      if (levels > 1) fs.mkdirSync(path.join(project_root, lang_nm), { recursive: true });
    }

    const path_params =
      trans.path && trans.path.trim().length
        ? trans.path
            .split(':')
            .map((v) => parseInt(v))
            .filter((v) => Number.isFinite(v))
        : [];

    const base = project_root;
    const file_path = (() => {
      if (path_params.length === 0) return path.join(base, `${lang_nm}.yaml`);
      const last = path_params[path_params.length - 1];
      return path.join(base, lang_nm, ...path_params.slice(0, -1).map(String), `${last}.yaml`);
    })();

    // Ensure directories exist for this file_path.
    const folder = path.dirname(file_path);
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
  console.log('Translation folder organized successfully');
}
main();
