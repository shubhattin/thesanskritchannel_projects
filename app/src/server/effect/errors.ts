import { Data } from 'effect';

export class AppServiceError extends Data.TaggedError('AppServiceError')<{
  operation: string;
  cause: unknown;
}> {}
