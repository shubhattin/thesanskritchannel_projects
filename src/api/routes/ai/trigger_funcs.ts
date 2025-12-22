import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { protectedAdminProcedure, protectedAppScopeProcedure, t } from '~/api/trpc_init';
import { tasks, auth, runs } from '@trigger.dev/sdk/v3';
import {
  translate_route_schema,
  TRANSLATE_TRIGGER_ID,
  IMAGE_GENERATE_TRIGGER_ID,
  image_gen_route_schema
} from '~/api/routes/ai/ai_types';
import { user_project_language_join } from '~/db/schema';
import { db } from '~/db/db';
import { and, eq } from 'drizzle-orm';

auth.configure({
  secretKey: env.TRIGGER_SECRET_KEY
});

const translate_route = protectedAppScopeProcedure
  .input(translate_route_schema.input)
  .mutation(
    async ({ ctx: { user }, input: { lang_id, model, text_name, text_data, project_id } }) => {
      if (user.role !== 'admin') {
        const languages = await db
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
        const allowed_langs = languages.map((lang) => lang.lang_id);
        if (!allowed_langs || !allowed_langs.includes(lang_id)) return { success: false };
      }
      const handle = await tasks.trigger(TRANSLATE_TRIGGER_ID, {
        project_id,
        lang_id,
        text_name,
        text_data,
        model
      });

      const run_id = handle.id;

      return { run_id, output_type: null! as z.infer<typeof translate_route_schema.output> };
    }
  );

const generate_image_trigger_route = protectedAdminProcedure
  .input(image_gen_route_schema.input)
  .query(async ({ input: { image_prompt, number_of_images, image_model } }) => {
    const handle = await tasks.trigger(IMAGE_GENERATE_TRIGGER_ID, {
      image_prompt,
      number_of_images,
      image_model
    });

    const run_id = handle.id;

    return { run_id, output_type: null! as z.infer<typeof image_gen_route_schema.output> };
  });

const retrive_run_info_route = protectedAppScopeProcedure
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
  translate_trigger: translate_route,
  generate_image_trigger: generate_image_trigger_route,
  retrive_run_info: retrive_run_info_route
});
