import { Cause, Option } from 'effect';
import { isKnownError, type KnownError } from './errors';

const CAUSE_TEXT_LIMIT = 16_000;

const CLIENT_ERROR_TAGS = new Set<KnownError['_tag']>([
  'NotFoundError',
  'BadRequestError',
  'ValidationError',
  'UnauthorizedError',
  'ForbiddenError',
  'ConflictError'
]);

export type ExceptionProperties = {
  effect_cause?: string;
  effect_tag?: string;
  effect_fields?: string;
};

export type CapturedException = {
  readonly error: Error;
  readonly properties: ExceptionProperties;
};

export type EffectCauseSnapshot = {
  readonly pretty: string;
  readonly message: string;
  readonly name: string;
  readonly tag?: string;
  readonly fields?: string;
};

type EffectErrorFields = {
  _tag: string;
  operation?: string;
  key?: string;
  provider?: string;
  batchId?: string;
  message?: string;
  resource?: string;
  cause_message?: string;
};

const snapshots = new WeakMap<Error, EffectCauseSnapshot>();

export const isServerKnownError = (error: KnownError): boolean =>
  !CLIENT_ERROR_TAGS.has(error._tag);

/**
 * Defects and server-side tagged failures belong in error tracking.
 * Expected 4xx domain errors and interrupt-only causes do not.
 */
export const isReportableCause = (cause: Cause.Cause<unknown>): boolean => {
  if (Cause.hasDies(cause)) return true;
  if (!Cause.hasFails(cause)) return false;
  const failure = Cause.findErrorOption(cause);
  if (Option.isNone(failure)) return true;
  if (!isKnownError(failure.value)) return true;
  return isServerKnownError(failure.value);
};

export const asError = (cause: unknown): Error | undefined =>
  cause instanceof Error ? cause : undefined;

const clip = (value: string): string =>
  value.length > CAUSE_TEXT_LIMIT ? `${value.slice(0, CAUSE_TEXT_LIMIT)}…` : value;

const isNonEmptyString = (cause: unknown): cause is string =>
  typeof cause === 'string' && cause.length > 0;

const nestedCauseMessage = (cause: unknown): string | undefined => {
  if (cause instanceof Error && cause.message) return cause.message;
  if (isNonEmptyString(cause)) return cause;
  return undefined;
};

const withNested = (label: string, nested: string | undefined): string =>
  nested ? `${label}: ${nested}` : label;

const labeled = (operation: string, detail: string | undefined): string =>
  detail ? `${operation} (${detail})` : operation;

const operationSummary = (tag: string, operation: string, cause: unknown): string =>
  withNested(`${tag}: ${operation}`, nestedCauseMessage(cause));

const knownSummary = (error: KnownError): string => {
  switch (error._tag) {
    case 'DatabaseError':
    case 'RedisError':
    case 'ImageProcessingError':
    case 'QueueError':
    case 'AuthError':
      return operationSummary(error._tag, error.operation, error.cause);
    case 'CacheError':
    case 'StorageError':
      return operationSummary(error._tag, labeled(error.operation, error.key), error.cause);
    case 'AiProviderError':
      return operationSummary(error._tag, labeled(error.operation, error.provider), error.cause);
    case 'BatchError':
      return operationSummary(error._tag, labeled(error.operation, error.batchId), error.cause);
    case 'ConfigError':
    case 'ValidationError':
    case 'BadRequestError':
    case 'ConflictError':
      return `${error._tag}: ${error.message}`;
    case 'NotFoundError':
      return `${error._tag}: ${error.resource}: ${error.message}`;
    case 'UnauthorizedError':
    case 'ForbiddenError':
      return error.message ? `${error._tag}: ${error.message}` : error._tag;
  }
};

const withCauseMessage = (error: KnownError, fields: EffectErrorFields): EffectErrorFields => {
  if (!('cause' in error)) return fields;
  const nested = nestedCauseMessage(error.cause);
  if (!nested) return fields;
  return { ...fields, cause_message: nested };
};

const withOptional = (
  fields: EffectErrorFields,
  key: 'key' | 'provider' | 'batchId' | 'message',
  value: string | undefined
): EffectErrorFields => (value ? { ...fields, [key]: value } : fields);

const baseFields = (error: KnownError): EffectErrorFields => {
  switch (error._tag) {
    case 'DatabaseError':
    case 'RedisError':
    case 'ImageProcessingError':
    case 'QueueError':
    case 'AuthError':
      return { _tag: error._tag, operation: error.operation };
    case 'CacheError':
    case 'StorageError':
      return withOptional({ _tag: error._tag, operation: error.operation }, 'key', error.key);
    case 'AiProviderError':
      return withOptional(
        { _tag: error._tag, operation: error.operation },
        'provider',
        error.provider
      );
    case 'BatchError':
      return withOptional(
        { _tag: error._tag, operation: error.operation },
        'batchId',
        error.batchId
      );
    case 'ConfigError':
    case 'ValidationError':
    case 'BadRequestError':
    case 'ConflictError':
      return { _tag: error._tag, message: error.message };
    case 'NotFoundError':
      return { _tag: error._tag, resource: error.resource, message: error.message };
    case 'UnauthorizedError':
    case 'ForbiddenError':
      return withOptional({ _tag: error._tag }, 'message', error.message);
  }
};

const knownFields = (error: KnownError): EffectErrorFields =>
  withCauseMessage(error, baseFields(error));

const withMessage = (error: Error, message: string): Error => {
  if (error.message.trim()) return error;
  error.message = message;
  if (!error.stack) return error;
  const newline = error.stack.indexOf('\n');
  error.stack =
    newline === -1
      ? `${error.name}: ${message}`
      : `${error.name}: ${message}${error.stack.slice(newline)}`;
  return error;
};

const capturedProperties = (pretty: string, known: KnownError | undefined): ExceptionProperties => {
  const properties: ExceptionProperties = {};
  if (pretty) properties.effect_cause = clip(pretty);
  if (!known) return properties;
  properties.effect_tag = known._tag;
  properties.effect_fields = clip(JSON.stringify(knownFields(known)));
  return properties;
};

/** Turns an Effect `Cause` into one Error plus the full pretty cause text. */
export const exceptionFromCause = (cause: Cause.Cause<unknown>): CapturedException => {
  const pretty = Cause.pretty(cause);
  const [primary] = Cause.prettyErrors(cause, { includeCauseInStack: true });
  const failure = Cause.findErrorOption(cause);
  const known = Option.isSome(failure) && isKnownError(failure.value) ? failure.value : undefined;
  const fallback = known ? knownSummary(known) : pretty.split('\n')[0] || 'Effect failure';
  return {
    error: withMessage(primary ?? new Error(fallback), fallback),
    properties: capturedProperties(pretty, known)
  };
};

export const attachEffectCause = (target: Error, cause: Cause.Cause<unknown>): void => {
  const captured = exceptionFromCause(cause);
  const snapshot: EffectCauseSnapshot = {
    pretty: captured.properties.effect_cause ?? '',
    message: captured.error.message,
    name: captured.error.name,
    tag: captured.properties.effect_tag,
    fields: captured.properties.effect_fields
  };
  snapshots.set(target, snapshot);
};

export const readEffectCause = (target: Error): EffectCauseSnapshot | undefined =>
  snapshots.get(target);

export const isClientFailure = (cause: unknown): boolean => {
  if (isKnownError(cause)) return !isServerKnownError(cause);
  const thrown = asError(cause);
  if (thrown && isKnownError(thrown.cause)) return !isServerKnownError(thrown.cause);
  return false;
};
