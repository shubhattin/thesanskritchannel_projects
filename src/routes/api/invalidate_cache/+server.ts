import { redis } from '~/db/redis';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { db } from '~/db/db';
import { error } from '@sveltejs/kit';

const CACHE_KEY_DB_NAME = 'cache_verify_key';

export const POST: RequestHandler = async ({ url, request }) => {
  const key = z.string().uuid().parse(request.headers.get('X-Cache-Verify-Key'));
  const KEY = await db.query.other.findFirst({
    where: (tbl, { eq }) => eq(tbl.key, CACHE_KEY_DB_NAME)
  });
  if (!KEY || key !== KEY.value) {
    throw error(401, 'UNAUTHORIZED');
  }

  const { keys } = z
    .object({
      keys: z.array(z.string())
    })
    .parse(await request.json());

  await redis.del(...keys);

  return new Response(JSON.stringify({ success: true }), {
    status: 200
  });
};
