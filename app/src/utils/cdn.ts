import { Effect } from 'effect';
import { AppPublicConfig } from '~/effect/config';
import { getAppPublicConfig } from '~/effect/app_runtime.server';

/** Pure CDN URL builder — pass resolved cloudfront base. */
export const cdnUrl = (cloudfrontUrl: string, s3_key: string) => `${cloudfrontUrl}/${s3_key}`;

/** Effect CDN URL via AppPublicConfig (server Effects). */
export const getCDNUrl = Effect.fn('getCDNUrl')(function* (s3_key: string) {
  const pub = yield* AppPublicConfig;
  return cdnUrl(pub.cloudfrontUrl, s3_key);
});

/** Sync helper for app server promise bridges (lazy AppPublicConfig). */
export const getCDNUrlSync = (s3_key: string) => {
  const pub = getAppPublicConfig();
  return cdnUrl(pub.cloudfrontUrl, s3_key);
};
