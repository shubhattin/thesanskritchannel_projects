import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import { get_project_from_key, PROJECT_INFO, type project_keys_type } from '~/state/project_list';
import { type_1_map_schema, type_2_map_schema, type_3_map_schema } from '~/state/data_types';
import { type } from 'arktype';

const ShlokaList = type({
  text: 'string',
  index: 'number.integer',
  shloka_number: 'number.integer?'
}).array();

describe('Checking correct shape of data', () => {
  it('Checking correct Map Structure', () => {
    for (let key in PROJECT_INFO) {
      const id = get_project_from_key(key as project_keys_type).id;
      const project_info = PROJECT_INFO[key as project_keys_type];
      const { levels } = project_info;
      const map_loc = `./data/${id}. ${key}/${key}_map.json`;
      const data = JSON.parse(fs.readFileSync(map_loc, 'utf-8'));
      if (levels === 1) {
        type_1_map_schema.parse(data);
      } else if (levels === 2) {
        type_2_map_schema.parse(data);
      } else if (levels === 3) {
        type_3_map_schema.parse(data);
      }
    }
  });
  it('Checking Shloka Text Data', () => {
    for (let key in PROJECT_INFO) {
      const project_info = PROJECT_INFO[key as project_keys_type];
      const id = get_project_from_key(key as project_keys_type).id;
      const data_folder = `./data/${id}. ${key}/data`;

      // Function to recursively process all JSON files in a directory
      const processDirectory = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = `${dir}/${entry.name}`;

          if (entry.isDirectory()) {
            // Recursively process subdirectories
            processDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            // Process JSON files
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

            const out = ShlokaList(data);
            if (out instanceof type.errors) {
              throw new Error(`Validation failed for ${fullPath}`);
            }
          }
        }
      };
      if (project_info.levels > 1) processDirectory(data_folder);
      else {
        const out = ShlokaList(JSON.parse(fs.readFileSync(`${data_folder}.json`, 'utf-8')));
        if (out instanceof type.errors) {
          throw new Error(`Validation failed for ${key}`);
        }
      }
    }
  });
});
