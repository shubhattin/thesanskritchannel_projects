import { describe, expect, it } from 'vitest';
import { REDIS_CACHE_KEYS_CLIENT, REDIS_CACHES_ARGUMENTS_LIST } from '~/db/redis_shared';

describe('REDIS_CACHE_KEYS_CLIENT', () => {
  it('builds text_data keys from path params array or string', () => {
    expect(REDIS_CACHE_KEYS_CLIENT.text_data(12, [1, 2, 3])).toBe('text_data:12:1/2/3');
    expect(REDIS_CACHE_KEYS_CLIENT.text_data(12, '1/2/3')).toBe('text_data:12:1/2/3');
  });

  it('builds translation and project map keys', () => {
    expect(REDIS_CACHE_KEYS_CLIENT.translation(5, 2, [0, 1])).toBe('trans_data:5:2:0/1');
    expect(REDIS_CACHE_KEYS_CLIENT.project_map(9)).toBe('project_map:9');
    expect(REDIS_CACHE_KEYS_CLIENT.project_list()).toBe('project_list');
  });

  it('keeps argument lists aligned with key builders', () => {
    expect(Object.keys(REDIS_CACHES_ARGUMENTS_LIST).sort()).toEqual(
      Object.keys(REDIS_CACHE_KEYS_CLIENT).sort()
    );
    expect(REDIS_CACHES_ARGUMENTS_LIST.text_data).toEqual(['project_id', 'path_params']);
    expect(REDIS_CACHES_ARGUMENTS_LIST.project_list).toEqual([]);
  });
});
