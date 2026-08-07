import { Layer, ManagedRuntime } from 'effect';
import {
  AppConfig,
  AppPublicConfig,
  makeSharedConfigFromAppConfig,
  SharedConfig,
  type AppConfigInput,
  type AppPublicConfigInput,
  type SharedConfigInput
} from './config';
import { Database } from './database';
import { RedisClient } from './redis';
import { ObjectStorage } from './storage';
import { AiProvider, OpenAiBatchClient } from './ai';
import { ImageProcessor } from './image';
import { BackgroundWork } from './background';
import { QStashPublisher } from './qstash';

/**
 * Shared infrastructure for app + site: config, DB, Redis, background.
 * ImageProcessor stays out of the site layer so site Effects stay site-safe.
 */
export const makeSharedInfrastructureLayer = (shared: SharedConfigInput) => {
  const sharedConfigLayer = SharedConfig.layer(shared);
  return Layer.mergeAll(Database.Live, RedisClient.Live, BackgroundWork.Live).pipe(
    Layer.provideMerge(sharedConfigLayer)
  );
};

/**
 * Full app layer: shared infra + S3, AI, images, QStash, public config.
 * SharedConfig is derived from AppConfig so Database/Redis stay SharedConfig-only.
 */
export const makeAppLayer = (app: AppConfigInput, publicConfig: AppPublicConfigInput) => {
  const appConfigLayer = AppConfig.layer(app);
  const publicConfigLayer = AppPublicConfig.layer(publicConfig);

  return Layer.mergeAll(
    ImageProcessor.Live,
    BackgroundWork.Live,
    Database.Live,
    RedisClient.Live,
    ObjectStorage.Live,
    AiProvider.Live,
    OpenAiBatchClient.Live,
    QStashPublisher.Live,
    publicConfigLayer
  ).pipe(Layer.provideMerge(makeSharedConfigFromAppConfig), Layer.provideMerge(appConfigLayer));
};

/** Site layer — DB + Redis + background only. */
export const makeSiteLayer = (shared: SharedConfigInput) => makeSharedInfrastructureLayer(shared);

export const makeAppRuntime = (app: AppConfigInput, publicConfig: AppPublicConfigInput) =>
  ManagedRuntime.make(makeAppLayer(app, publicConfig));

export const makeSiteRuntime = (shared: SharedConfigInput) =>
  ManagedRuntime.make(makeSiteLayer(shared));

export type AppRuntime = ReturnType<typeof makeAppRuntime>;
export type SiteRuntime = ReturnType<typeof makeSiteRuntime>;
