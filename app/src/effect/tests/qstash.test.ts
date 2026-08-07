import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
import { aiBatchResultsPayloadSchema, decodeQstashPayload, qstashDelaySeconds } from '../qstash';
import { ValidationError } from '../errors';

describe('qstashDelaySeconds', () => {
  it('floors and clamps negative delays to zero', () => {
    expect(qstashDelaySeconds(-1.5)).toBe(0);
    expect(qstashDelaySeconds(0)).toBe(0);
    expect(qstashDelaySeconds(2.9)).toBe(2);
    expect(qstashDelaySeconds(10)).toBe(10);
  });
});

describe('decodeQstashPayload', () => {
  it('decodes a valid AI batch results payload', async () => {
    const exit = await Effect.runPromiseExit(
      decodeQstashPayload(aiBatchResultsPayloadSchema, {
        batch_id: 'batch_abc',
        poll_attempt: 0
      })
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({ batch_id: 'batch_abc', poll_attempt: 0 });
    }
  });

  it('fails with ValidationError for missing fields', async () => {
    const result = await Effect.runPromise(
      decodeQstashPayload(aiBatchResultsPayloadSchema, { batch_id: 'batch_abc' }).pipe(Effect.flip)
    );
    expect(result).toBeInstanceOf(ValidationError);
    expect(result._tag).toBe('ValidationError');
    expect(result.message).toBe('Invalid QStash payload');
  });

  it('rejects empty batch_id and negative poll_attempt', async () => {
    const emptyId = await Effect.runPromise(
      decodeQstashPayload(aiBatchResultsPayloadSchema, {
        batch_id: '',
        poll_attempt: 1
      }).pipe(Effect.flip)
    );
    expect(emptyId._tag).toBe('ValidationError');

    const negativeAttempt = await Effect.runPromise(
      decodeQstashPayload(aiBatchResultsPayloadSchema, {
        batch_id: 'batch_abc',
        poll_attempt: -1
      }).pipe(Effect.flip)
    );
    expect(negativeAttempt._tag).toBe('ValidationError');
  });
});
