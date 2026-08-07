import { Effect, Schema } from 'effect';
import {
  aiBatchResultsPayloadSchema,
  type AiBatchResultsPayload,
  QStashPublisher
} from '~/effect/qstash';
import { runServerEffect } from '~/effect/app_runtime.server';

/** @deprecated Prefer `aiBatchResultsPayloadSchema` — kept for existing import paths. */
export const ai_batch_results_publish_schema = aiBatchResultsPayloadSchema;

export { aiBatchResultsPayloadSchema };
export type { AiBatchResultsPayload };

export const decodeAiBatchResultsPayload = (input: unknown): AiBatchResultsPayload =>
  Schema.decodeUnknownSync(aiBatchResultsPayloadSchema)(input);

export const publishAiBatchResultsQueue = async (
  data: AiBatchResultsPayload,
  delay_s: number
): Promise<void> =>
  runServerEffect(
    Effect.gen(function* () {
      const q = yield* QStashPublisher;
      yield* q.publishAiBatchResults(data, delay_s);
    })
  );
