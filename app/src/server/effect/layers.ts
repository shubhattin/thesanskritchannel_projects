import { Layer } from 'effect';
import { CacheServiceLive } from './cache';
import { ConfigServiceLive } from './config';
import { DbServiceLive } from './db';
import { LoaderServiceLive } from './loader';
import { ProjectServiceLive } from './project';
import { RedisServiceLive } from './redis';

export const AppLive = Layer.mergeAll(
  ConfigServiceLive,
  DbServiceLive,
  RedisServiceLive,
  CacheServiceLive,
  ProjectServiceLive,
  LoaderServiceLive
);
