import { Cause, Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { DatabaseError, NotFoundError } from '../errors';
import {
  exceptionFromCause,
  isReportableCause,
  readEffectCause,
  attachEffectCause
} from '../exception_report';

describe('exceptionFromCause', () => {
  it('keeps the nested cause for a tagged Effect error with an empty message', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(DatabaseError.make({ operation: 'select', cause: new Error('connection reset') }))
    );
    if (exit._tag !== 'Failure') throw new Error('expected failure');

    const captured = exceptionFromCause(exit.cause);
    expect(captured.error.name).toBe('DatabaseError');
    expect(captured.error.message).toContain('select');
    expect(captured.error.message).toContain('connection reset');
    expect(captured.error.stack).toContain('connection reset');
    expect(captured.properties.effect_tag).toBe('DatabaseError');
    expect(captured.properties.effect_cause).toContain('connection reset');
    expect(captured.properties.effect_fields).toContain('"operation":"select"');
    expect(captured.properties.effect_fields).toContain('connection reset');
    expect(isReportableCause(exit.cause)).toBe(true);
  });

  it('does not report expected 4xx domain errors', () => {
    const cause = Cause.fail(NotFoundError.make({ resource: 'text', message: 'missing text' }));
    expect(isReportableCause(cause)).toBe(false);
  });

  it('reports defects and attaches the pretty cause onto the thrown value', () => {
    const cause = Cause.die(new Error('boom defect'));
    expect(isReportableCause(cause)).toBe(true);
    const thrown = new Error('wrapper');
    attachEffectCause(thrown, cause);
    const snapshot = readEffectCause(thrown);
    expect(snapshot?.name).toBe('Error');
    expect(snapshot?.pretty).toContain('boom defect');
    expect(snapshot?.message).toContain('boom defect');
  });
});
