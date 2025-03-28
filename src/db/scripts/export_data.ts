import { dbClient_ext as db, queryClient } from './client';
import { readFile } from 'fs/promises';
import { dbMode, take_input } from '~/tools/kry.server';
import {
  user,
  account,
  user_project_join,
  user_project_language_join,
  verification,
  translation
} from '~/db/schema';
import {
  UserSchemaZod,
  AccountSchemaZod,
  UserProjectJoinSchemaZod,
  UserProjectLanguageJoinSchemaZod,
  VerificationSchemaZod,
  TranslationSchemaZod
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
      user: UserSchemaZod.array(),
      account: AccountSchemaZod.array(),
      user_project_join: UserProjectJoinSchemaZod.array(),
      user_project_language_join: UserProjectLanguageJoinSchemaZod.array(),
      verification: VerificationSchemaZod.array(),
      translation: TranslationSchemaZod.array()
    })
    .parse(JSON.parse((await readFile(`./out/${in_file_name}`)).toString()));

  // deleting all the tables initially
  try {
    await db.delete(user);
    await db.delete(account);
    await db.delete(verification);
    await db.delete(user_project_join);
    await db.delete(user_project_language_join);
    await db.delete(user_project_language_join);
    await db.delete(translation);
    console.log(chalk.green('✓ Deleted All Tables Successfully'));
  } catch (e) {
    console.log(chalk.red('✗ Error while deleting tables:'), chalk.yellow(e));
  }

  // inserting user
  try {
    await db.insert(user).values(data.user);
    console.log(chalk.green('✓ Successfully added values into table'), chalk.blue('`users`'));
  } catch (e) {
    console.log(chalk.red('✗ Error while inserting users:'), chalk.yellow(e));
  }

  // inserting account
  try {
    await db.insert(account).values(data.account);
    console.log(chalk.green('✓ Successfully added values into table'), chalk.blue('`account`'));
  } catch (e) {
    console.log(chalk.red('✗ Error while inserting account:'), chalk.yellow(e));
  }

  // inserting verification
  try {
    await db.insert(verification).values(data.verification);
    console.log(
      chalk.green('✓ Successfully added values into table'),
      chalk.blue('`verification`')
    );
  } catch (e) {
    console.log(chalk.red('✗ Error while inserting verification:'), chalk.yellow(e));
  }

  // resetting user_project_join
  try {
    await db.insert(user_project_join).values(data.user_project_join);
    console.log(
      chalk.green('✓ Successfully added values into table'),
      chalk.blue('`user_project_join`')
    );
  } catch (e) {
    console.log(chalk.red('✗ Error while inserting user_project_join:'), chalk.yellow(e));
  }

  // resetting user_project_language_join
  try {
    await db.insert(user_project_language_join).values(data.user_project_language_join);
    console.log(
      chalk.green('✓ Successfully added values into table'),
      chalk.blue('`user_project_language_join`')
    );
  } catch (e) {
    console.log(chalk.red('✗ Error while inserting user_project_language_join:'), chalk.yellow(e));
  }

  // resetting translation
  try {
    await db.insert(translation).values(data.translation);
    console.log(chalk.green('✓ Successfully added values into table'), chalk.blue('`translation`'));
  } catch (e) {
    console.log(chalk.red('✗ Error while inserting translation:'), chalk.yellow(e));
  }

  // resetting SERIAL
  try {
    // await db.execute(sql`SELECT setval('"project_id_seq"', (select MAX(id) from "project"))`);
    console.log(chalk.green('✓ Successfully resetted ALL SERIAL'));
  } catch (e) {
    console.log(chalk.red('✗ Error while resetting SERIAL:'), chalk.yellow(e));
  }
};
main().then(() => {
  queryClient.end();
});

async function confirm_environemnt() {
  let confirmation: string = await take_input(`Are you sure INSERT in ${dbMode} ? `);
  if (['yes', 'y'].includes(confirmation)) return true;
  return false;
}
