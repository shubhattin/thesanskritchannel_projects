import { Effect, Layer, ManagedRuntime } from 'effect';
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
import { BackgroundWorkLive } from './live/background';
import { QStashPublisher } from './qstash';
import { isCloudflareWorker } from './platform';

/**
 * Image live for the current runtime. workerd uses the Cloudflare Images
 * binding (`./live/cf_images`); Miniflare does not emulate Images, so local
 * `vite dev` / Vitest (Node) use the sharp live (`./live/sharp_images`).
 * Both modules stay dynamically imported: `sharp` has native bindings that
 * cannot enter the Worker bundle (see `external` in vite.config.ts).
 */
const imageProcessorLive = Layer.unwrap(
  Effect.gen(function* () {
    if (isCloudflareWorker()) {
      return (yield* Effect.promise(() => import('./live/cf_images'))).ImageProcessorLive;
    }
    return (yield* Effect.promise(() => import('./live/sharp_images'))).ImageProcessorLive;
  })
);

/**
 * Full app layer: shared infra + S3, AI, images, QStash, public config.
 * SharedConfig is derived from AppConfig so Database/Redis stay
 * SharedConfig-only.
 *
 * Database uses the Workers-safe per-query driver: workerd isolates I/O to
 * the creating request, so no pooled client may outlive it.
 */
export const makeAppLayer = (app: AppConfigInput, publicConfig: AppPublicConfigInput) => {
  const appConfigLayer = AppConfig.layer(app);
  const publicConfigLayer = AppPublicConfig.layer(publicConfig);

  return Layer.mergeAll(
    imageProcessorLive,
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
