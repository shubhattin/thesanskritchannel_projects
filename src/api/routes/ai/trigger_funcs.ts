import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { protectedProcedure, t } from '~/api/trpc_init';
import { tasks, auth, runs } from '@trigger.dev/sdk/v3';
import { chapter_translate_schema, TRANSLATE_TRIGGER_ID } from '~/api/routes/ai/ai_types';
import { user_project_language_join } from '~/db/schema';
import { db } from '~/db/db';
import { and, eq } from 'drizzle-orm';

auth.configure({
  secretKey: env.TRIGGER_SECRET_KEY
});

const translate_chapter_route = protectedProcedure
  .input(chapter_translate_schema.input)
  .mutation(async ({ ctx: { user }, input: { lang_id, messages, model, project_id } }) => {
    if (user.role !== 'admin') {
      const langugaes = await db
        .select({
          lang_id: user_project_language_join.language_id
        })
        .from(user_project_language_join)
        .where(
          and(
            eq(user_project_language_join.user_id, user.id),
            eq(user_project_language_join.project_id, project_id)
          )
        );
      if (!user.is_approved) return { success: false };
      const allowed_langs = langugaes.map((lang) => lang.lang_id);
      if (!allowed_langs || !allowed_langs.includes(lang_id)) return { success: false };
    }
    const handle = await tasks.trigger(TRANSLATE_TRIGGER_ID, {
      project_id,
      lang_id,
      messages,
      model
    });

    const run_id = handle.id;

    return { run_id, output_type: null! as z.infer<typeof chapter_translate_schema.output> };
  });

const retrive_run_info_route = protectedProcedure
  .input(z.object({ run_id: z.string() }))
  .output(
    z.union([
      z.object({ completed: z.literal(false) }),
      z.object({
        completed: z.literal(true),
        output: z.any(),
        time_taken: z.number().int()
      }),
      z.object({
        error_code: z.string()
      })
    ])
  )
  .query(async ({ input: { run_id } }) => {
    if (!run_id) return { error_code: 'UNAUTHORIZED' };
    const run_info = await runs.retrieve(run_id);
    if (run_info.status !== 'COMPLETED') return { completed: false };
    else if (run_info.status === 'COMPLETED') {
      const time_taken = run_info.finishedAt!.getTime() - run_info.startedAt!.getTime();
      return { completed: true, output: run_info.output, time_taken };
    }
    return { error_code: run_info.status };
  });

export const trigger_funcs_router = t.router({
  translate_chapter: translate_chapter_route,
  retrive_run_info: retrive_run_info_route
});
