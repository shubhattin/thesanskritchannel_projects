import { Context, Effect, Layer } from 'effect';
import {
  get_site_lekha_data_func,
  get_site_lekha_list_func,
  get_text_data_func,
  get_translation_data_func
} from '../cache/cached_loader';
import { CacheService } from './cache';
import { tryPromise } from './try-promise';

export const get_text_data_effect = (key: string, pathParams: number[]) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getTextData', () => get_text_data_func(key, pathParams, options))
  );

export const get_translation_data_effect = (
  projectId: number,
  langId: number,
  selectedTextLevels: (number | null)[]
) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getTranslationData', () =>
      get_translation_data_func(projectId, langId, selectedTextLevels, options)
    )
  );

export const get_site_lekha_data_effect = (urlSlug: string) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getSiteLekhaData', () => get_site_lekha_data_func(urlSlug, options))
  );

export const get_site_lekha_list_effect = () =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getSiteLekhaList', () => get_site_lekha_list_func(options))
  );

export class LoaderService extends Context.Tag('LoaderService')<
  LoaderService,
  {
    readonly getTextData: typeof get_text_data_effect;
    readonly getTranslationData: typeof get_translation_data_effect;
    readonly getSiteLekhaData: typeof get_site_lekha_data_effect;
    readonly getSiteLekhaList: typeof get_site_lekha_list_effect;
  }
>() {}

export const LoaderServiceLive = Layer.succeed(LoaderService, {
  getTextData: get_text_data_effect,
  getTranslationData: get_translation_data_effect,
  getSiteLekhaData: get_site_lekha_data_effect,
  getSiteLekhaList: get_site_lekha_list_effect
});
