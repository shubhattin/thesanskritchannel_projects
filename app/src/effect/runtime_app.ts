import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  AppConfig,
  AppPublicConfig,
  SharedConfigFromAppConfigLayer,
  type AppConfigInput,
  type AppPublicConfigInput
} from './config';
import { Database, DatabaseHttp } from './database';
import { RedisClient } from './redis';
import { ObjectStorage } from './storage';
import { AiProvider, OpenAiBatchClient } from './ai';
import { BackgroundWork } from './background';
import { CfEnv } from './cf_env';
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
 * Full app layer: shared infra + session DB + HTTP DB, S3, AI, images, QStash, public config.
 * SharedConfig is derived from AppConfig so Database/Redis stay
 * SharedConfig-only.
 *
 * Both DB drivers use the Workers-safe per-query layers: workerd isolates I/O to
 * the creating request, so no pooled client may outlive it. `Database` stays for
 * interactive transactions / advisory locks; one-shot reads/writes go through
 * `DatabaseHttp` (Neon fetch in prod).
 */
export const makeAppLayer = (
  app: AppConfigInput,
  publicConfig: AppPublicConfigInput,
  platform?: App.Platform
) => {
  const appConfigLayer = AppConfig.layer(app);
  const publicConfigLayer = AppPublicConfig.layer(publicConfig);

  return Layer.mergeAll(
    imageProcessorLive,
    BackgroundWork.Live,
    Database.WorkersLive,
    DatabaseHttp.WorkersLive,
    RedisClient.Live,
    ObjectStorage.Live,
    AiProvider.Live,
    OpenAiBatchClient.Live,
    QStashPublisher.Live,
    publicConfigLayer
  ).pipe(
    Layer.provideMerge(platform ? CfEnv.layer(platform) : CfEnv.Test),
    Layer.provideMerge(SharedConfigFromAppConfigLayer),
    Layer.provideMerge(appConfigLayer)
  );
};

export const makeAppRuntime = (
  app: AppConfigInput,
  publicConfig: AppPublicConfigInput,
  platform?: App.Platform
) => ManagedRuntime.make(makeAppLayer(app, publicConfig, platform));

export type AppRuntime = ReturnType<typeof makeAppRuntime>;
