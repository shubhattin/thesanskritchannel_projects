import * as fs from 'fs';
import { z } from 'zod';
import { dbClient_ext as db, queryClient } from './client';
import { json2csv } from 'json-2-csv';

const OUT_FOLDER = './backup';

async function main() {
  if (!fs.existsSync(OUT_FOLDER)) fs.mkdirSync(OUT_FOLDER);

  const envs_parsed = z
    .object({
      PG_DATABASE_URL: z.string()
    })
    .safeParse(process.env);
  if (!envs_parsed.success) {
    console.error(envs_parsed.error);
    return;
  }

  const trans_data = {
    translation: await db.query.translation.findMany()
  };
  const JSON_TRANS_DATA_FILE = `${OUT_FOLDER}/translations.json`;
  fs.writeFileSync(JSON_TRANS_DATA_FILE, JSON.stringify(trans_data, null, 2));
  const csv = json2csv(trans_data.translation);
  fs.writeFileSync(`${OUT_FOLDER}/translation.csv`, csv);
}

main().then(() => queryClient.end());
