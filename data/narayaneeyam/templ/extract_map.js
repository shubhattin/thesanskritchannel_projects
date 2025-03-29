import * as fs from 'fs';
import { lipi_parivartak } from '../../../src/tools/converter/lekhika_core';
import exceljs from 'exceljs';

const main = async () => {
  const worksheet = new exceljs.Workbook();
  const path = 'data/narayaneeyam/templ/list_dashakams.xlsx';
  const workbook = await worksheet.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  const list = [];
  for (let i = 1; i <= 100; i++) {
    const name_dev = sheet.getCell(1 + i, 4).value;
    const name_nor = await lipi_parivartak(name_dev, 'Hindi', 'Normal');
    list.push({
      name_dev,
      name_nor,
      shloka_count: 10,
      pos: i,
      total: 10 + 4
    });
  }
  fs.writeFileSync('data/narayaneeyam/narayaneeyam_map.json', JSON.stringify(list, null, 2));
};
main();
