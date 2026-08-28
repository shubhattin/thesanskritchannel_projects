import { Cause, Effect, Exit, Option, type ManagedRuntime } from 'effect';
import { TRPCError } from '@trpc/server';
import { isKnownError, type KnownError } from './errors';

/** Domain / config errors with distinct tRPC codes; infra errors share the default. */
type TrpcCodeByTag = { [T in KnownError['_tag']]?: TRPCError['code'] };
const TRPC_CODE_BY_TAG: TrpcCodeByTag = {
  NotFoundError: 'NOT_FOUND',
  BadRequestError: 'BAD_REQUEST',
  ValidationError: 'BAD_REQUEST',
  ConflictError: 'CONFLICT',
  UnauthorizedError: 'UNAUTHORIZED',
  ForbiddenError: 'FORBIDDEN',
  ConfigError: 'INTERNAL_SERVER_ERROR'
};

const toTrpcMessage = (error: KnownError): string => {
  switch (error._tag) {
    case 'NotFoundError':
    case 'BadRequestError':
    case 'ValidationError':
    case 'ConflictError':
    case 'ConfigError':
      return error.message;
    case 'UnauthorizedError':
      return error.message ?? 'Unauthorized';
    case 'ForbiddenError':
      return error.message ?? 'Forbidden';
    default:
      return 'Unexpected server error';
  }
};

const toTrpcError = (error: KnownError): TRPCError =>
  new TRPCError({
    code: TRPC_CODE_BY_TAG[error._tag] ?? 'INTERNAL_SERVER_ERROR',
    message: toTrpcMessage(error),
    cause: error
  });

const httpStatusForError = (error: KnownError): number => {
  switch (error._tag) {
    case 'NotFoundError':
      return 404;
    case 'BadRequestError':
    case 'ValidationError':
      return 400;
    case 'ConflictError':
      return 409;
    case 'UnauthorizedError':
      return 401;
    case 'ForbiddenError':
      return 403;
    default:
      return 500;
  }
};

/**
 * Boundary runners bound to a ManagedRuntime (app or site).
 *
 * `RQ extends R` accepts domain Effects that need a subset of the runtime's
 * services (Effect's R is covariant / `out`).
 */
export const createRunners = <R, E>(runtime: ManagedRuntime.ManagedRuntime<R, E>) => {
  const runTrpcEffect = async <A, EX, RQ extends R>(
    effect: Effect.Effect<A, EX, RQ>
  ): Promise<A> => {
    const exit = await runtime.runPromiseExit(
      effect.pipe(Effect.annotateLogs({ boundary: 'trpc' }))
    );

    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure) && isKnownError(failure.value)) {
      const err = failure.value;
      // Known domain errors: log as warn so prod log drains catch 5xx vs 4xx split
      // 5xx-like (CacheError/DatabaseError/RedisError/StorageError/ConfigError/BatchError) -> error
      const is5xx = ![
        'NotFoundError',
        'BadRequestError',
        'ValidationError',
        'UnauthorizedError',
        'ForbiddenError',
        'ConflictError'
      ].includes(err._tag);
      const msg = `[trpc] known error ${err._tag}: ${toTrpcMessage(err)}`;
      if (is5xx) console.error(msg, { tag: err._tag, cause: Cause.pretty(exit.cause) });
      else console.warn(msg, { tag: err._tag, cause: Cause.pretty(exit.cause) });
      throw toTrpcError(failure.value);
    }

    console.error('[trpc] unexpected effect defect', Cause.pretty(exit.cause));
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error',
      cause: exit.cause
    });
  };

  const runServerEffect = async <A, EX, RQ extends R>(
    effect: Effect.Effect<A, EX, RQ>
  ): Promise<A> => {
    const exit = await runtime.runPromiseExit(
      effect.pipe(Effect.annotateLogs({ boundary: 'server' }))
    );
    if (Exit.isSuccess(exit)) return exit.value;
    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure) && isKnownError(failure.value)) {
      console.error('[server] known error', {
        tag: failure.value._tag,
        cause: Cause.pretty(exit.cause)
      });
    } else {
      console.error('[server] unexpected defect', Cause.pretty(exit.cause));
    }
    // Re-throw as original cause so SvelteKit/Astro error handler sees it
    throw Cause.squash(exit.cause);
  };

  const runRouteEffect = async <A, EX, RQ extends R>(
    effect: Effect.Effect<A, EX, RQ>,
    options?: {
      onSuccess?: (value: A) => Response;
    }
  ): Promise<Response> => {
    const exit = await runtime.runPromiseExit(
      effect.pipe(Effect.annotateLogs({ boundary: 'route' }))
    );

    if (Exit.isSuccess(exit)) {
      return options?.onSuccess?.(exit.value) ?? Response.json(exit.value);
    }

    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure) && isKnownError(failure.value)) {
      const err = failure.value;
      const status = httpStatusForError(err);
      const level = status >= 500 ? 'error' : 'warn';
      const log = level === 'error' ? console.error : console.warn;
      log(`[route] known error ${err._tag} -> ${status}`, {
        tag: err._tag,
        status,
        cause: Cause.pretty(exit.cause)
      });
      return Response.json({ error: toTrpcMessage(err), tag: err._tag }, { status });
    }

    console.error('[route] unexpected effect defect', Cause.pretty(exit.cause));
    return Response.json({ error: 'Unexpected server error' }, { status: 500 });
  };

  const runQstashEffect = async <A, EX, RQ extends R>(
    effect: Effect.Effect<A, EX, RQ>,
    options?: {
      onSuccess?: (value: A) => Response;
    }
  ): Promise<Response> => {
    const exit = await runtime.runPromiseExit(
      effect.pipe(Effect.annotateLogs({ boundary: 'qstash' }))
    );

    if (Exit.isSuccess(exit)) {
      return options?.onSuccess?.(exit.value) ?? new Response('OK', { status: 200 });
    }

    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure) && isKnownError(failure.value)) {
      const err = failure.value;
      const status = httpStatusForError(err);
      const level = status >= 500 ? 'error' : 'warn';
      const log = level === 'error' ? console.error : console.warn;
      log(`[qstash] known error ${err._tag} -> ${status}`, {
        tag: err._tag,
        status,
        cause: Cause.pretty(exit.cause)
      });
      return Response.json({ error: toTrpcMessage(err), tag: err._tag }, { status });
    }

    console.error('[qstash] unexpected effect defect', Cause.pretty(exit.cause));
    return Response.json({ error: 'Unexpected server error' }, { status: 500 });
  };

  return {
    runTrpcEffect,
    runServerEffect,
    runRouteEffect,
    runQstashEffect,
    runTrpcEffectResult: runTrpcEffect
  };
};

export type EffectRunners<R, E> = ReturnType<typeof createRunners<R, E>>;
