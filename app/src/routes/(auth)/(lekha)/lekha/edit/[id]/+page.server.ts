import { db } from '~/db/db';
import type { PageServerLoad } from './$types';
import { z } from 'zod';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
  const { id } = z.object({ id: z.coerce.number().int() }).parse(params);
  const lekha = await db.query.site_lekhas.findFirst({
    where: (tbl, { eq }) => eq(tbl.id, id)
  });
  if (!lekha) {
    error(404, 'Lekha not found');
  }
  return { lekha };
};
