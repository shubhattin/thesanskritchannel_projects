import { Client } from '@upstash/qstash';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const client = new Client({
  token: env.QSTASH_TOKEN,
  baseUrl: env.QSTASH_BASE_URL
}); // load from env

const QSTAHS_PUBLISH_BASE_URL = `${import.meta.env.VITE_SITE_URL}/api/qstash`;

const PROD_MODE = import.meta.env.PROD;

export const ai_batch_results_publish_schema = z.object({
  batch_id: z.string().min(1),
  poll_attempt: z.number().int().min(0).default(0)
});
export const publishAiBatchResultsQueue = async (
  data: z.infer<typeof ai_batch_results_publish_schema>,
  delay_s: number
) => {
  if (!import.meta.env.VITE_SITE_URL || !PROD_MODE) {
    console.debug(
      `Skipping AI batch QStash publish for ${data.batch_id}: ${
        !import.meta.env.VITE_SITE_URL ? 'VITE_SITE_URL missing' : 'not in production mode'
      }`
    );
    return;
  }
  const body = ai_batch_results_publish_schema.parse(data);

  await client.publishJSON({
    url: QSTAHS_PUBLISH_BASE_URL + '/save_ai_batch_results',
    delay: delay_s,
    body
  });
  console.log(`Queue published to poll AI batch ${body.batch_id} (delay: ${delay_s}s)`);
};
