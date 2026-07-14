import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { Receiver } from '@upstash/qstash';
import { eq } from 'drizzle-orm';
import { ai_batch_results_publish_schema, publishAiBatchResultsQueue } from '~/utils/qstash';
import { poll_batch_shloka_image_gen_func } from '~/api/routes/batch_ai';
import { poll_batch_text_translation_func } from '~/api/routes/batch_ai_text';
import { BATCH_POLLING_INTERVAL_S, MAX_BATCH_POLL_ATTEMPTS } from '~/utils/types/ai_batch_metadata';
import { db } from '~/db/db';
import { ai_batches } from '~/db/schema';
import { env } from '$env/dynamic/private';

export const config: Config = {
  split: true,
  /** More time to save bigger workfloaads */
  maxDuration: 1500 // stil be beta but should work
};

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY ?? '',
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY ?? ''
});

export const POST: RequestHandler = async ({ request }) => {
  const signature = request.headers.get('upstash-signature') ?? '';
  const body_text = await request.text();

  try {
    await receiver.verify({
      signature,
      body: body_text
    });
  } catch (err) {
    console.error('QStash signature verification failed', err);
    throw error(401, 'Invalid QStash signature');
  }

  console.log('QStash AI batch poll request received', new Date());
  const body = ai_batch_results_publish_schema.parse(JSON.parse(body_text));
  const { batch_id, poll_attempt } = body;

  if (poll_attempt >= MAX_BATCH_POLL_ATTEMPTS) {
    // Preserve failed/expired inspection in DB; stop automation after ~24h.
    console.warn(
      `AI batch ${batch_id} stalled: exhausted poll attempts (${poll_attempt}/${MAX_BATCH_POLL_ATTEMPTS}); manual attention required`
    );
    return new Response(
      `Batch ${batch_id} exceeded max poll attempts (${MAX_BATCH_POLL_ATTEMPTS})`,
      { status: 200 }
    );
  }

  const batch_row = await db.query.ai_batches.findFirst({
    columns: { type: true },
    where: eq(ai_batches.batch_id, batch_id)
  });

  // Missing batch after cleanup is a successful no-op.
  if (!batch_row) {
    return new Response(`Batch ${batch_id} already resolved or cleaned up`, { status: 200 });
  }

  const result =
    batch_row.type === 'object'
      ? await poll_batch_text_translation_func(batch_id)
      : await poll_batch_shloka_image_gen_func(batch_id);

  if (result.status === 'already_resolved') {
    return new Response(`Batch ${batch_id} already resolved`, { status: 200 });
  }

  if (result.status === 'pending') {
    await publishAiBatchResultsQueue(
      { batch_id, poll_attempt: poll_attempt + 1 },
      BATCH_POLLING_INTERVAL_S
    );
    return new Response(
      `Batch ${batch_id} still ${result.openai_status}; next poll scheduled in ${BATCH_POLLING_INTERVAL_S}s (attempt ${poll_attempt + 1}/${MAX_BATCH_POLL_ATTEMPTS})`,
      { status: 200 }
    );
  }

  if (result.status === 'terminal_failure') {
    return new Response(`Batch ${batch_id} failed with status ${result.openai_status}`, {
      status: 200
    });
  }

  const succeeded = result.items.filter((item) => item.success).length;
  return new Response(
    `Batch ${batch_id} processed: ${succeeded}/${result.items.length} items succeeded`,
    { status: 200 }
  );
};
