import { Effect } from 'effect';
import { AppServiceError } from './errors';

export const tryPromise = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new AppServiceError({ operation, cause })
  });
