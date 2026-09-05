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
import { ImageProcessor } from './image';
import { BackgroundWorkLive } from './live/background';
import { QStashPublisher } from './qstash';

/**
 * Full app layer: shared infra + S3, AI, images, QStash, public config.
 * Kept in this module so the site Worker graph never imports `sharp` / S3 / AI.
 * SharedConfig is derived from AppConfig so Database/Redis stay SharedConfig-only.
 *
 * Background `waitUntil` is the Vercel Live in `./live/background`.
 */
export const makeAppLayer = (app: AppConfigInput, publicConfig: AppPublicConfigInput) => {
  const appConfigLayer = AppConfig.layer(app);
  const publicConfigLayer = AppPublicConfig.layer(publicConfig);

  return Layer.mergeAll(
    ImageProcessor.Live,
    BackgroundWorkLive,
    Database.Live,
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

let _appRuntime: AppRuntime | undefined;

/**
 * Lazy app runtime singleton. SvelteKit postbuild analyse runs with empty
 * `$env/dynamic/private`, so construction must wait for the first request;
 * `loadInputs` is invoked at most once.
 */
export const appRuntime = (
  loadInputs: () => readonly [AppConfigInput, AppPublicConfigInput]
): AppRuntime => (_appRuntime ??= makeAppRuntime(...loadInputs()));

export type AppRuntime = ReturnType<typeof makeAppRuntime>;
