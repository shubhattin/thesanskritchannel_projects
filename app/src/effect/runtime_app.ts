import { Layer, ManagedRuntime } from 'effect';
import {
  AppConfig,
  AppPublicConfig,
  SharedConfigFromAppConfigLayer,
  type AppConfigInput,
  type AppPublicConfigInput
} from './config';
import { Database } from './database';
import { RedisClient } from './redis';
import { ObjectStorage } from './storage';
import { AiProvider, OpenAiBatchClient } from './ai';
import { ImageProcessorLive } from './live/cf_images';
import { BackgroundWorkLive } from './live/background';
import { QStashPublisher } from './qstash';

/**
 * Full app layer: shared infra + S3, AI, images, QStash, public config.
 * Image work goes through the Cloudflare Images live (`./live/cf_images`);
 * the sharp live (`./live/sharp_images`) is Node/Vitest-only and must never
 * enter the Worker graph. SharedConfig is derived from AppConfig so
 * Database/Redis stay SharedConfig-only.
 *
 * Database uses the Workers-safe per-query driver: workerd isolates I/O to
 * the creating request, so no pooled client may outlive it.
 */
export const makeAppLayer = (app: AppConfigInput, publicConfig: AppPublicConfigInput) => {
  const appConfigLayer = AppConfig.layer(app);
  const publicConfigLayer = AppPublicConfig.layer(publicConfig);

  return Layer.mergeAll(
    ImageProcessorLive,
    BackgroundWorkLive,
    Database.WorkersLive,
    RedisClient.Live,
    ObjectStorage.Live,
    AiProvider.Live,
    OpenAiBatchClient.Live,
    QStashPublisher.Live,
    publicConfigLayer
  ).pipe(Layer.provideMerge(SharedConfigFromAppConfigLayer), Layer.provideMerge(appConfigLayer));
};

export const makeAppRuntime = (app: AppConfigInput, publicConfig: AppPublicConfigInput) =>
  ManagedRuntime.make(makeAppLayer(app, publicConfig));

export type AppRuntime = ReturnType<typeof makeAppRuntime>;
