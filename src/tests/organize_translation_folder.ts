import * as fs from 'fs';
import js_yaml from 'js-yaml';
import { get_lang_from_id } from '~/state/lang_list';
import {
  get_project_from_id,
  get_project_info_from_id,
  get_project_from_key,
  type project_keys_type
} from '~/state/project_list';
import { TranslationSchemaZod } from '~/db/schema_zod';
import type { z } from 'zod';

// this file should be called from root dir
async function main() {
  if (!fs.existsSync('./src/db/scripts/backup/translation.json')) return;

  const translations = JSON.parse(
    fs.readFileSync('./src/db/scripts/backup/translation.json', 'utf8')
  ) as z.infer<typeof TranslationSchemaZod>[];
  const trans_folder = './data/translations/';
  if (fs.existsSync(trans_folder)) fs.rmSync(trans_folder, { recursive: true });
  fs.mkdirSync(trans_folder);

  const data: {
    [project: string]: {
      [lang: string]: {
        [second: number]: {
          [first: number]: Map<number, string>;
        };
        // ^ the keys are not number even if we make in number as that is how javascript is
      };
    };
  } = {};

  for (let trans of translations) {
    const project_key = get_project_info_from_id(trans.project_id).key;
    const project_id = get_project_from_id(trans.project_id).id;
    const levels = get_project_info_from_id(project_id).levels;
    if (!data[project_key]) {
      data[project_key] = {};
      fs.mkdirSync(`./data/translations/${project_id}. ${project_key}`);
    }
    const lang_nm = get_lang_from_id(trans.lang_id);
    if (!data[project_key][lang_nm]) {
      data[project_key][lang_nm] = {};
      if (levels > 1) fs.mkdirSync(`./data/translations/${project_id}. ${project_key}/${lang_nm}`);
    }
    const second = trans.second;
    if (!data[project_key][lang_nm][second]) {
      data[project_key][lang_nm][second] = {};
      if (second !== 0)
        fs.mkdirSync(`./data/translations/${project_id}. ${project_key}/${lang_nm}/${second}`);
    }
    const first = trans.first;
    if (!data[project_key][lang_nm][second][first]) {
      data[project_key][lang_nm][second][first] = new Map();
    }
    data[project_key][lang_nm][second][first].set(trans.index, trans.text);
  }

  for (const project_key in data) {
    const project_id = get_project_from_key(project_key as project_keys_type).id;
    for (const lang in data[project_key]) {
      for (const second in data[project_key][lang]) {
        for (const first in data[project_key][lang][second]) {
          const trans_data = data[project_key][lang][second][first];
          const file_path =
            `./data/translations/${project_id}. ${project_key}` +
            (() => {
              if (first === '0' && second === '0') return `/${lang}.yaml`;
              else if (second === '0') return `/${lang}/${first}.yaml`;
              else return `/${lang}/${second}/${first}.yaml`;
            })();

          fs.writeFileSync(file_path, js_yaml.dump(Object.fromEntries(trans_data), { indent: 2 }), {
            encoding: 'utf-8'
          });
        }
      }
    }
  }
}
main();
