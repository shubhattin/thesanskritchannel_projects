import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_LIST } from '~/state/project_list';
import { recursive_list_schema } from '~/state/data_types';
import { type } from 'arktype';

const ShlokaList = type({
  text: 'string',
  index: 'number.integer',
  shloka_number: 'number.integer?'
}).array();

const data_root = fileURLToPath(new URL('../../../data/', import.meta.url));

describe('Checking correct shape of data', () => {
  it('Checking correct Map Structure', () => {
    for (const project of PROJECT_LIST) {
      const project_folder = path.join(data_root, `${project.id}. ${project.key}`);
      const map_loc = path.join(project_folder, `${project.key}_map.json`);
      const data = JSON.parse(fs.readFileSync(map_loc, 'utf-8'));
      recursive_list_schema.parse(data);
    }
  });
  it('Checking Shloka Text Data', () => {
    for (const project of PROJECT_LIST) {
      const project_folder = path.join(data_root, `${project.id}. ${project.key}`);
      const level1_file = path.join(project_folder, 'data.json');
      const data_folder = path.join(project_folder, 'data');

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
      if (fs.existsSync(level1_file)) {
        const out = ShlokaList(JSON.parse(fs.readFileSync(level1_file, 'utf-8')));
        if (out instanceof type.errors) {
          throw new Error(`Validation failed for ${project.key}`);
        }
      } else {
        processDirectory(data_folder);
      }
    }
  });
});
