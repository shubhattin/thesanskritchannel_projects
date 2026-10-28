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
  site_lekha_redirects,
  projects,
  project_paths,
  project_redirects,
  image_assets,
  image_system_prompt_templates,
  ai_batches,
  ai_batch_responses,
  text_image_assets_join,
  agent_chats,
  agent_messages
} from '~/db/schema';
import {
  UserProjectJoinSchemaZod,
  UserProjectLanguageJoinSchemaZod,
  TranslationSchemaZod,
  TextSchemaZod,
  MediaAttachmentSchemaZod,
  OtherSchemaZod,
  SiteLekhaSchemaZod,
  SiteLekhaRedirectSchemaZod,
  ProjectRedirectSchemaZod,
  ProjectSchemaZod,
  ProjectPathSchemaZod,
  ImageAssetSchemaZod,
  ImageSystemPromptTemplatesSchemaZod,
  AiBatchesSchemaZod,
  AiBatchResponsesSchemaZod,
  TextImageAssetsJoinSchemaZod,
  AgentChatsSchemaZod,
  AgentMessagesSchemaZod
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
      project_paths: ProjectPathSchemaZod.array(),
      // Optional so backups written before redirects existed still restore.
      site_lekha_redirects: SiteLekhaRedirectSchemaZod.array().optional().default([]),
      project_redirects: ProjectRedirectSchemaZod.array().optional().default([]),
      // Optional so backups written before these tables existed still restore.
      image_assets: ImageAssetSchemaZod.array().optional().default([]),
      image_system_prompt_templates: ImageSystemPromptTemplatesSchemaZod.array()
        .optional()
        .default([]),
      ai_batches: AiBatchesSchemaZod.array().optional().default([]),
      ai_batch_responses: AiBatchResponsesSchemaZod.array().optional().default([]),
      text_image_assets_join: TextImageAssetsJoinSchemaZod.array().optional().default([]),
      agent_chats: AgentChatsSchemaZod.array().optional().default([]),
      agent_messages: AgentMessagesSchemaZod.array().optional().default([])
    })
    .parse(JSON.parse((await readFile(`./out/${in_file_name}`)).toString()));

  // Awaited so the restore finishes before the client closes (and before the
  // cache flush below runs against committed data).
  await dbClient_ext.transaction(async (tx) => {
    // deleting all the tables initially
    try {
      // Children first (FK order: path rows → projects, redirect rows → parents)
      await tx.delete(agent_messages);
      await tx.delete(ai_batch_responses);
      await tx.delete(text_image_assets_join);
      await tx.delete(translations);
      await tx.delete(texts);
      await tx.delete(media_attachment);
      await tx.delete(user_project_join);
      await tx.delete(user_project_language_join);
      await tx.delete(project_paths);
      await tx.delete(project_redirects);
      await tx.delete(site_lekha_redirects);
      await tx.delete(projects);
      await tx.delete(other);
      await tx.delete(site_lekhas);
      await tx.delete(image_assets);
      await tx.delete(image_system_prompt_templates);
      await tx.delete(agent_chats);
      await tx.delete(ai_batches);
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

    // resetting image_assets (before texts: FK texts.image_id)
    try {
      if (data.image_assets.length > 0) {
        await tx.insert(image_assets).values(data.image_assets);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`image_assets`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting image_assets:'), chalk.yellow(e));
    }

    // resetting image_system_prompt_templates
    try {
      if (data.image_system_prompt_templates.length > 0) {
        await tx.insert(image_system_prompt_templates).values(data.image_system_prompt_templates);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`image_system_prompt_templates`')
      );
    } catch (e) {
      console.log(
        chalk.red('✗ Error while inserting image_system_prompt_templates:'),
        chalk.yellow(e)
      );
    }

    // resetting ai_batches (before ai_batch_responses: FK batch_id)
    try {
      if (data.ai_batches.length > 0) {
        await tx.insert(ai_batches).values(data.ai_batches);
      }
      console.log(chalk.green('✓ Successfully added values into table'), chalk.blue('`ai_batches`'));
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting ai_batches:'), chalk.yellow(e));
    }

    // resetting agent_chats (before agent_messages: FK chat_id)
    try {
      if (data.agent_chats.length > 0) {
        await tx.insert(agent_chats).values(data.agent_chats);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`agent_chats`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting agent_chats:'), chalk.yellow(e));
    }

    // resetting project_paths
    try {
      for (const chunk of chunkArray(data.project_paths, 5000)) {
        await tx.insert(project_paths).values(chunk);
      }
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

    // resetting text_image_assets_join (after project_paths + image_assets)
    try {
      if (data.text_image_assets_join.length > 0) {
        await tx.insert(text_image_assets_join).values(data.text_image_assets_join);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`text_image_assets_join`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting text_image_assets_join:'), chalk.yellow(e));
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

    // resetting site_lekha_redirects (after site_lekhas: FK lekha_id)
    try {
      if (data.site_lekha_redirects.length > 0) {
        await tx.insert(site_lekha_redirects).values(data.site_lekha_redirects);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`site_lekha_redirects`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting site_lekha_redirects:'), chalk.yellow(e));
    }

    // resetting project_redirects (after projects: FK project_id)
    try {
      if (data.project_redirects.length > 0) {
        await tx.insert(project_redirects).values(data.project_redirects);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`project_redirects`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting project_redirects:'), chalk.yellow(e));
    }

    // resetting ai_batch_responses (after ai_batches: FK batch_id)
    try {
      if (data.ai_batch_responses.length > 0) {
        await tx.insert(ai_batch_responses).values(data.ai_batch_responses);
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`ai_batch_responses`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting ai_batch_responses:'), chalk.yellow(e));
    }

    // resetting agent_messages (after agent_chats: FK chat_id)
    try {
      if (data.agent_messages.length > 0) {
        const chunks = chunkArray(data.agent_messages, 5000);
        for (const chunk of chunks) {
          await tx.insert(agent_messages).values(chunk);
        }
      }
      console.log(
        chalk.green('✓ Successfully added values into table'),
        chalk.blue('`agent_messages`')
      );
    } catch (e) {
      console.log(chalk.red('✗ Error while inserting agent_messages:'), chalk.yellow(e));
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
      await tx.execute(
        sql`SELECT setval('"site_lekha_redirects_id_seq"', (select MAX(id) from "site_lekha_redirects"))`
      );
      await tx.execute(
        sql`SELECT setval('"project_redirects_id_seq"', (select MAX(id) from "project_redirects"))`
      );
      await tx.execute(
        sql`SELECT setval('"image_assets_id_seq"', (select MAX(id) from "image_assets"))`
      );
      await tx.execute(
        sql`SELECT setval('"image_system_prompt_templates_id_seq"', (select MAX(id) from "image_system_prompt_templates"))`
      );
      await tx.execute(
        sql`SELECT setval('"text_image_assets_join_id_seq"', (select MAX(id) from "text_image_assets_join"))`
      );
      console.log(chalk.green('✓ Successfully resetted ALL SERIAL'));
    } catch (e) {
      console.log(chalk.red('✗ Error while resetting SERIAL:'), chalk.yellow(e));
    }
  });

  // The restore rewrites keys/slugs/redirects out-of-band; drop the cached
  // redirect maps so the site rebuilds them instead of serving stale 301s.
  await flushRedirectMapKeys(['project_redirect_map', 'site_lekha_slug_map']);
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

/**
 * Best-effort Upstash REST `DEL` for cache keys the restore invalidates.
 * Never throws — on failure the operator must flush the keys manually.
 */
async function flushRedirectMapKeys(keys: string[]): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.log(
      chalk.yellow('! UPSTASH_REDIS_REST_URL/TOKEN not set — flush Redis keys manually:'),
      chalk.yellow(keys.join(', '))
    );
    return;
  }
  try {
    const res = await fetch(`${url}/del/${keys.map(encodeURIComponent).join('/')}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(chalk.green('✓ Flushed Redis keys:'), chalk.blue(keys.join(', ')));
  } catch (error) {
    console.log(
      chalk.red('✗ Redis flush failed — flush manually:'),
      chalk.yellow(keys.join(', ')),
      error
    );
  }
}
