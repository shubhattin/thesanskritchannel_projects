import { Context, Layer } from 'effect';

export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly isProd: boolean;
    readonly isDev: boolean;
  }
>() {}

export const ConfigServiceLive = Layer.succeed(ConfigService, {
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV
});
