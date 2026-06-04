import { dbClient_ext, query_client } from './client';
import { readFile } from 'fs/promises';
import { dbMode, take_input } from '~/tools/kry.server';
import {
  user_project_join,
  user_project_language_join,
  translations,
  media_attachment,
  other,
  texts,
  site_lekhas,
  projects,
  project_paths
} from '~/db/schema';
import {
  UserProjectJoinSchemaZod,
  UserProjectLanguageJoinSchemaZod,
  TranslationSchemaZod,
  TextSchemaZod,
  MediaAttachmentSchemaZod,
  OtherSchemaZod,
  SiteLekhaSchemaZod,
  ProjectSchemaZod,
  ProjectPathSchemaZod
} from '~/db/schema_zod';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import chalk from 'chalk';

const main = async () => {
  /*
   Better backup & restore tools like `pg_dump` and `pg_restore` should be used.
  
   Although Here the foriegn key relations are not that complex so we are doing it manually
  */
  if (!(await confirm_environemnt())) return;

  console.log(`Insering Data into ${dbMode} Database...`);

  const in_file_name = {
    PROD: 'db_data_prod.json',
    PREVIEW: 'db_data_preview.json',
    LOCAL: 'db_data.json'
  }[dbMode];

  const data = z
    .object({
      user_project_join: UserProjectJoinSchemaZod.array(),
      user_project_language_join: UserProjectLanguageJoinSchemaZod.array(),
      projects: ProjectSchemaZod.array(),
      translations: TranslationSchemaZod.array(),
      texts: TextSchemaZod.array(),
      other: OtherSchemaZod.array(),
      media_attachment: MediaAttachmentSchemaZod.array(),
      site_lekhas: SiteLekhaSchemaZod.array(),
      project_paths: ProjectPathSchemaZod.array()
    })
    .parse(JSON.parse((await readFile(`./out/${in_file_name}`)).toString()));

  dbClient_ext.transaction(async (tx) => {
    // deleting all the tables initially
    try {
      // Children first (FK order: path rows → projects)
      await tx.delete(translations);
      await tx.delete(texts);
      await tx.delete(media_attachment);
      await tx.delete(user_project_join);
      await tx.delete(user_project_language_join);
      await tx.delete(project_paths);
      await tx.delete(projects);
      await tx.delete(other);
      await tx.delete(site_lekhas);
      console.log(chalk.green('✓ Deleted All Tables Successfully'));
    } catch (e) {
      console.log(chalk.red('✗ Error while deleting tables:'), chalk.yellow(e));
    }

    // resetting projects
    try {
      await tx.insert(projects).values(data.projects);
      console.log(chalk.green('✓ Successfully added values into table'), chalk.blue('`projects`'));
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting projects:'), chalk.yellow(e));
    }

    // resetting project_paths
    try {
      await tx.insert(project_paths).values(data.project_paths);
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`project_paths`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting project_paths:'), chalk.yellow(e));
    }

    // resetting user_project_join
    try {
      await tx.insert(user_project_join).values(data.user_project_join);
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`user_project_join`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting user_project_join:'), chalk.yellow(e));
    }

    // resetting user_project_language_join
    try {
      await tx.insert(user_project_language_join).values(data.user_project_language_join);
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`user_project_language_join`')
      );
    } catch (e) {
      console.log(
        chalk.red('✗ Error while inserting user_project_language_join:'),
        chalk.yellow(e)
      );
    }

    // resetting texts
    try {
      const chunks = chunkArray(data.texts, 5000);
      for (const chunk of chunks) {
        await tx.insert(texts).values(chunk);
      }
      console.log(chalk.green('✓ Successfully added values into table'), chalk.blue('`texts`'));
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting text:'), chalk.yellow(e));
    }

    // resetting translation
    try {
      const chunks = chunkArray(data.translations, 5000);
      for (const chunk of chunks) {
        await tx.insert(translations).values(chunk);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`translations`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting translation:'), chalk.yellow(e));
    }

    // resetting other
    try {
      await tx.insert(other).values(data.other);
      console.log(chalk.green('✓ Successfully added values into table'), chalk.blue('`other`'));
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting other:'), chalk.yellow(e));
    }

    // resetting media_attachment
    try {
      await tx.insert(media_attachment).values(data.media_attachment);
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`media_attachment`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting media_attachment:'), chalk.yellow(e));
    }

    // resetting site_lekhas
    try {
      await tx.insert(site_lekhas).values(data.site_lekhas);
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`site_lekhas`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting site_lekhas:'), chalk.yellow(e));
    }

    // resetting SERIAL
    try {
      await tx.execute(sql`SELECT setval('"projects_id_seq"', (select MAX(id) from "projects"))`);
      await tx.execute(
        sql`SELECT setval('"project_paths_id_seq"', (select MAX(id) from "project_paths"))`
      );
      await tx.execute(
        sql`SELECT setval('"media_attachment_id_seq"', (select MAX(id) from "media_attachment"))`
      );
      await tx.execute(
        sql`SELECT setval('"site_lekhas_id_seq"', (select MAX(id) from "site_lekhas"))`
      );
      console.log(chalk.green('✓ Successfully resetted ALL SERIAL'));
    } catch (e) {
      console.log(chalk.red('✗ Error while resetting SERIAL:'), chalk.yellow(e));
    }
  });
};
main().then(() => {
  query_client.end();
});

async function confirm_environemnt() {
  let confirmation: string = await take_input(`Are you sure INSERT in ${dbMode} ? `);
  if (['yes', 'y'].includes(confirmation)) return true;
  return false;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
