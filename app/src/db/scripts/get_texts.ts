// this file gets all the texts from the local json files and dump them in the db compatible schema
import z from 'zod';
import { PROJECT_LIST } from '../../state/project_list';
import { TextSchemaZod } from '../schema_zod';
import fs from 'node:fs';
import path from 'node:path';
import { remove_vedic_svara_chihnAni } from '~/utils/normalize_text';

const text_schema = z.object({
  text: z.string(),
  index: z.number(),
  shloka_num: z.number().nullable()
});

const list_json_files_recursive = (root_dir: string): string[] => {
  const out: string[] = [];
  const stack: string[] = [root_dir];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        out.push(full);
      }
    }
  }

  // stable-ish ordering so output isn't OS traversal dependent
  out.sort((a, b) => a.localeCompare(b));
  return out;
};

const get_db_path_from_json_file = (data_folder: string, json_file: string): string => {
  const rel = path.relative(data_folder, json_file);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length === 0) return '';

  const file = parts[parts.length - 1] ?? '';
  const base = file.toLowerCase().endsWith('.json') ? file.slice(0, -'.json'.length) : file;

  const path_parts = [...parts.slice(0, -1), base].filter(Boolean);
  return path_parts.join(':');
};

const main = async () => {
  const texts: z.infer<typeof TextSchemaZod>[] = [];
  for (const project of PROJECT_LIST) {
    // console.log(`Processing ${project.key}...`);
    const level1_file = `../../../data/${project.id}. ${project.key}/data.json`;
    if (fs.existsSync(level1_file)) {
      const data = text_schema.array().parse(JSON.parse(fs.readFileSync(level1_file, 'utf-8')));
      let project_text_count = 0;
      for (const text of data) {
        texts.push({
          project_id: project.id,
          path: '',
          text: text.text,
          index: text.index,
          shloka_num: text.shloka_num,
          text_search: remove_vedic_svara_chihnAni(text.text)
        });
        project_text_count += 1;
      }
      console.log(`${project.key} has ${project_text_count} texts`);
    } else {
      const data_folder = `../../../data/${project.id}. ${project.key}/data`;
      const json_files = list_json_files_recursive(data_folder);

      let project_text_count = 0;
      for (const json_file of json_files) {
        const db_path = get_db_path_from_json_file(data_folder, json_file);
        const data = text_schema.array().parse(JSON.parse(fs.readFileSync(json_file, 'utf-8')));

        for (const text of data) {
          texts.push({
            project_id: project.id,
            path: db_path,
            text: text.text,
            index: text.index,
            shloka_num: text.shloka_num,
            text_search: remove_vedic_svara_chihnAni(text.text)
          });
          project_text_count += 1;
        }
      }

      console.log(`${project.key} has ${project_text_count} texts`);
    }
  }

  console.log(`Total texts: ${texts.length}`);
  fs.mkdirSync('./out', { recursive: true });
  fs.writeFileSync('./out/texts.json', JSON.stringify(texts, null, 2));
  fs.writeFileSync('./out/texts_prod.json', JSON.stringify(texts, null, 2));
};

main();
