import { Effect } from 'effect';
import { z } from 'zod';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { runServerEffect } from '~/effect/app_runtime.server';
import { dbRun } from '~/effect/database';

export const load: PageServerLoad = async ({ params }) => {
  const { id } = z.object({ id: z.coerce.number().int() }).parse(params);
  const lekha = await runServerEffect(
    dbRun('lekha.edit.load', (db) =>
      db.query.site_lekhas.findFirst({
        where: (tbl, { eq }) => eq(tbl.id, id)
      })
    )
  );
  if (!lekha) {
    error(404, 'Lekha not found');
  }
  return { lekha };
};
