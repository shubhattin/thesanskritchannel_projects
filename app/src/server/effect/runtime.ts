import { Effect } from 'effect';
import { TRPCError } from '@trpc/server';
import { AppServiceError } from './errors';
import { AppLive } from './layers';

export const mapAppServiceError = (error: AppServiceError) =>
  new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Operation failed: ${error.operation}`,
    cause: error.cause
  });

export const runAppEffect = <A, E>(program: Effect.Effect<A, E, any>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provide(AppLive)) as Effect.Effect<A, E, never>);

/** Runs an app effect and maps {@link AppServiceError} to {@link TRPCError}. */
export const runAppEffectTrpc = <A>(program: Effect.Effect<A, AppServiceError, any>): Promise<A> =>
  runAppEffect(
    program.pipe(
      Effect.catchTag('AppServiceError', (error) => Effect.fail(mapAppServiceError(error)))
    )
  );
