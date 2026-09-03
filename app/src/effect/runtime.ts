import { Layer, ManagedRuntime } from 'effect';
import { SharedConfig, type SharedConfigInput } from './config';
import { Database } from './database';
import { RedisClient } from './redis';
import { BackgroundWork } from './background';

/**
 * Shared infrastructure for app + site: config, DB, Redis, background.
 * ImageProcessor / S3 / AI stay in `runtime_app.ts` so the site Worker graph
 * never imports native addons like `sharp`.
 */
export const makeSharedInfrastructureLayer = (shared: SharedConfigInput) => {
  const sharedConfigLayer = SharedConfig.layer(shared);
  return Layer.mergeAll(Database.Live, RedisClient.Live, BackgroundWork.Live).pipe(
    Layer.provideMerge(sharedConfigLayer)
  );
};

/** Site layer — DB + Redis + background only. */
export const makeSiteLayer = (shared: SharedConfigInput) => makeSharedInfrastructureLayer(shared);

export const makeSiteRuntime = (shared: SharedConfigInput) =>
  ManagedRuntime.make(makeSiteLayer(shared));

let _siteRuntime: SiteRuntime | undefined;

/** Lazy site runtime singleton — same cold-start rationale as `appRuntime`. */
export const siteRuntime = (loadShared: () => SharedConfigInput): SiteRuntime =>
  (_siteRuntime ??= makeSiteRuntime(loadShared()));

export type SiteRuntime = ReturnType<typeof makeSiteRuntime>;
