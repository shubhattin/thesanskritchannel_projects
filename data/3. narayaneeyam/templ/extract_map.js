import * as fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lipi_parivartak } from '../../../app/src/tools/converter/lekhika_core';
import exceljs from 'exceljs';

const template_file = fileURLToPath(new URL('./list_dashakams.xlsx', import.meta.url));
const output_file = fileURLToPath(new URL('../narayaneeyam_map.json', import.meta.url));

const main = async () => {
  const worksheet = new exceljs.Workbook();
  const workbook = await worksheet.xlsx.readFile(template_file);
  const sheet = workbook.worksheets[0];
  const list = [];
  for (let i = 1; i <= 100; i++) {
    const name_dev = sheet.getCell(1 + i, 4).value;
    const name_nor = await lipi_parivartak(name_dev, 'Sanskrit', 'Normal');
    list.push({
      name_dev,
      name_nor,
      shloka_count: 10,
      pos: i,
      total: 10 + 4
    });
  }
  fs.writeFileSync(output_file, JSON.stringify(list, null, 2));
};
main();
