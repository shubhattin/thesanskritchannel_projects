import { dbClient_ext as db, queryClient } from './client';
import { writeFile } from 'fs/promises';
import { dbMode, make_dir, take_input } from '../../tools/kry.server';

export const import_data = async (confirm_env = true) => {
  if (confirm_env && !(await confirm_environemnt())) return;

  console.log(`Fetching Data from ${dbMode} Database...`);

  const user_project_join = await db.query.user_project_join.findMany();
  const user_project_language_join = await db.query.user_project_language_join.findMany();
  const translation = await db.query.translation.findMany();
  const other = await db.query.other.findMany();
  const media_attachment = await db.query.media_attachment.findMany();

  const json_data = {
    user_project_join,
    user_project_language_join,
    translation,
    other,
    media_attachment
  };

  await make_dir('./out');
  const out_file_name = {
    PROD: 'db_data_prod.json',
    PREVIEW: 'db_data_preview.json',
    LOCAL: 'db_data.json'
  }[dbMode];
  await writeFile(`./out/${out_file_name}`, JSON.stringify(json_data, null, 2));
};

const isMainModule = () => {
  try {
    return import.meta.url === new URL(process.argv[1], 'file://').href;
  } catch {
    return false;
  }
};
if (isMainModule())
  import_data().then(() => {
    queryClient.end();
  });

async function confirm_environemnt() {
  let confirmation: string = await take_input(`Are you sure SELECT from ${dbMode} ? `);
  if (['yes', 'y'].includes(confirmation)) return true;
  return false;
}
