import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import { z } from 'zod';
import { PROJECT_INFO } from '~/state/project_list';
import {
  type_1_map_schema,
  type_2_map_schema,
  type_3_map_schema,
  shloka_list_schema
} from '~/state/data_types';

describe('Checking correct shape of data', () => {
  it('Checking correct Map Structure', () => {
    for (let project_info of PROJECT_INFO) {
      const { key, levels } = project_info;
      const map_loc = `./data/${key}/${key}_map.json`;
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
    for (let project_info of PROJECT_INFO) {
      const data_folder = `./data/${project_info.key}/data`;

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

            try {
              shloka_list_schema.parse(data);
            } catch (error) {
              console.error(error);
              throw new Error(`Validation failed for file: ${fullPath}`);
            }
          }
        }
      };

      processDirectory(data_folder);
    }
  });
  // for (let i = 1; i <= 18; i++) {
  //   it(`Checking data for chapter ${i}`, () => {
  //     const data = JSON.parse(fs.readFileSync(`./data/gita/data/${i}.json`, 'utf-8'));
  //     z.object({
  //       text: z.string(),
  //       index: z.number().int(),
  //       shloka_num: z.number().int().nullable()
  //     })
  //       .array()
  //       .parse(data);
  //   });
  // }
});
