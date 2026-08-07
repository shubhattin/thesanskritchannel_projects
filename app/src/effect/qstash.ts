import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import { Client, Receiver } from '@upstash/qstash';
import { AppConfig } from './config';
import { QueueError, UnauthorizedError, ValidationError } from './errors';

const NonNegInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const NonEmptyString = Schema.String.check(Schema.isMinLength(1));

export const aiBatchResultsPayloadSchema = Schema.Struct({
  batch_id: NonEmptyString,
  poll_attempt: NonNegInt
});

export type AiBatchResultsPayload = typeof aiBatchResultsPayloadSchema.Type;

/** QStash rejects negative/fractional delays; clamp after computing start_time − now − skew. */
export const qstashDelaySeconds = (seconds: number): number => Math.max(0, Math.floor(seconds));

const tryQueue = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => QueueError.make({ operation, cause })
  }).pipe(Effect.annotateLogs({ category: 'qstash', operation }));

export class QStashPublisher extends Context.Service<
  QStashPublisher,
  {
    readonly publishAiBatchResults: (
      data: AiBatchResultsPayload,
      delay_s: number
    ) => Effect.Effect<void, QueueError>;
  }
>()('QStashPublisher') {
  static readonly Live = Layer.effect(QStashPublisher)(
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const client = config.qstashBaseUrl
        ? new Client({
            token: Redacted.value(config.qstashToken),
            baseUrl: config.qstashBaseUrl
          })
        : new Client({
            token: Redacted.value(config.qstashToken)
          });
      const callbackBase = `${config.siteUrl}/api/qstash`;
      const enabled = config.isQstashEnabled;

      return {
        publishAiBatchResults: (data, delay_s) => {
          if (!enabled) {
            return Effect.sync(() => {
              console.debug(
                `Skipping AI batch QStash publish for ${data.batch_id}: QStash disabled`
              );
            });
          }
          return tryQueue('save_ai_batch_results', async () => {
            await client.publishJSON({
              url: `${callbackBase}/save_ai_batch_results`,
              delay: delay_s,
              body: data
            });
            console.log(`[qstash] published save_ai_batch_results (delay: ${delay_s}s)`);
          });
        }
      };
    })
  );
}

export const decodeQstashPayload = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
): Effect.Effect<S['Type'], ValidationError> =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(schema)(input),
    catch: (cause) =>
      ValidationError.make({
        message: 'Invalid QStash payload',
        cause
      })
  });

/** Verify an inbound QStash webhook using AppConfig signing keys. */
export const verifyQstashSignature = (
  signature: string,
  body: string
): Effect.Effect<void, UnauthorizedError, AppConfig> =>
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const receiver = new Receiver({
      currentSigningKey: Redacted.value(config.qstashCurrentSigningKey),
      nextSigningKey: Redacted.value(config.qstashNextSigningKey)
    });
    yield* Effect.tryPromise({
      try: () => receiver.verify({ signature, body }),
      catch: () => UnauthorizedError.make({ message: 'Invalid QStash signature' })
    });
  });
