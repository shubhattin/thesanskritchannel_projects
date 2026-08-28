import { Effect, Schema } from 'effect';
import {
  aiBatchResultsPayloadSchema,
  type AiBatchResultsPayload,
  QStashPublisher
} from '~/effect/qstash';

/** @deprecated Prefer `aiBatchResultsPayloadSchema` — kept for existing import paths. */
export const ai_batch_results_publish_schema = aiBatchResultsPayloadSchema;

export { aiBatchResultsPayloadSchema };
export type { AiBatchResultsPayload };

/**
 * Runtime re-validation of an `AiBatchResultsPayload` (no-op when the payload already conforms).
 * @deprecated Prefer `aiBatchResultsPayloadSchema` directly at the actual `unknown` I/O boundary.
 */
export const decodeAiBatchResultsPayload = (input: AiBatchResultsPayload): AiBatchResultsPayload =>
  Schema.decodeUnknownSync(aiBatchResultsPayloadSchema)(input);

export const publishAiBatchResultsQueue = (data: AiBatchResultsPayload, delay_s: number) =>
  Effect.gen(function* () {
    const q = yield* QStashPublisher;
    yield* q.publishAiBatchResults(data, delay_s);
  });
