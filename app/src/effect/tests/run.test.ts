import { describe, expect, it } from 'vitest';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { TRPCError } from '@trpc/server';
import { createRunners } from '../run';
import { NotFoundError, UnauthorizedError, ValidationError } from '../errors';

const makeTestRunners = () => {
  const runtime = ManagedRuntime.make(Layer.empty);
  return { runtime, runners: createRunners(runtime) };
};

describe('createRunners TRPC_CODE mapping', () => {
  it('maps NotFoundError to NOT_FOUND', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      await runners.runTrpcEffect(
        Effect.fail(NotFoundError.make({ resource: 'batch', message: 'missing batch' }))
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      if (!(err instanceof TRPCError)) return;
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('missing batch');
    } finally {
      await runtime.dispose();
    }
  });

  it('maps UnauthorizedError to UNAUTHORIZED', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      await runners.runTrpcEffect(Effect.fail(UnauthorizedError.make({ message: 'UNAUTHORIZED' })));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      if (!(err instanceof TRPCError)) return;
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('UNAUTHORIZED');
    } finally {
      await runtime.dispose();
    }
  });

  it('returns 401 JSON from runRouteEffect for UnauthorizedError', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      const response = await runners.runRouteEffect(
        Effect.fail(UnauthorizedError.make({ message: 'UNAUTHORIZED' }))
      );
      expect(response.status).toBe(401);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'UNAUTHORIZED', tag: 'UnauthorizedError' });
    } finally {
      await runtime.dispose();
    }
  });

  it('returns 401 JSON from runQstashEffect for UnauthorizedError', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      const response = await runners.runQstashEffect(
        Effect.fail(UnauthorizedError.make({ message: 'Invalid QStash signature' }))
      );
      expect(response.status).toBe(401);
      const body: unknown = await response.json();
      expect(body).toEqual({
        error: 'Invalid QStash signature',
        tag: 'UnauthorizedError'
      });
    } finally {
      await runtime.dispose();
    }
  });

  it('returns 400 JSON from runRouteEffect for ValidationError', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      const response = await runners.runRouteEffect(
        Effect.fail(ValidationError.make({ message: 'Invalid QStash payload' }))
      );
      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toEqual({
        error: 'Invalid QStash payload',
        tag: 'ValidationError'
      });
    } finally {
      await runtime.dispose();
    }
  });

  it('returns success JSON from runRouteEffect', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      const response = await runners.runRouteEffect(Effect.succeed({ ok: true as const }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    } finally {
      await runtime.dispose();
    }
  });

  it('uses onSuccess for runQstashEffect text responses', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      const response = await runners.runQstashEffect(Effect.succeed('Batch done'), {
        onSuccess: (message) => new Response(message, { status: 200 })
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Batch done');
    } finally {
      await runtime.dispose();
    }
  });

  it('returns 401 from runQstashEffect for UnauthorizedError', async () => {
    const { runtime, runners } = makeTestRunners();
    try {
      const response = await runners.runQstashEffect(
        Effect.fail(UnauthorizedError.make({ message: 'Invalid QStash signature' }))
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: 'Invalid QStash signature',
        tag: 'UnauthorizedError'
      });
    } finally {
      await runtime.dispose();
    }
  });
});
