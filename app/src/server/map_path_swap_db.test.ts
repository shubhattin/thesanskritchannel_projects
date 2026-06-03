import { describe, expect, it } from 'vitest';
import {
  applyPathSwapEditsToPath,
  dbPathMatchesPrefix,
  remapDbPathPrefix
} from './map_path_swap';
import {
  buildRedisKeysForPathSwapInvalidation,
  mergePathSwapInvalidation
} from './map_path_swap_db.server';

describe('map_path_swap_db', () => {
  it('matches exact paths and deep descendants on segment boundaries only', () => {
    expect(dbPathMatchesPrefix('1:1', '1:1')).toBe(true);
    expect(dbPathMatchesPrefix('1:1:1:2', '1:1')).toBe(true);
    expect(dbPathMatchesPrefix('1:10:1', '1:1')).toBe(false);
  });

  it('remaps upper-level prefixes without losing the deeper suffix', () => {
    expect(remapDbPathPrefix('1:1:1:2', '1:1', '1:2')).toBe('1:2:1:2');
    expect(remapDbPathPrefix('1:1', '1:1', '1:2')).toBe('1:2');
    expect(remapDbPathPrefix('1:10:1', '1:1', '1:2')).toBe('1:10:1');
  });

  it('applies subtree swaps to deep descendants the same way as the DB flow', () => {
    const edits = [{ swap_paths: ['1:1', '1:2'] as [string, string] }];

    expect(applyPathSwapEditsToPath('1:1', edits)).toBe('1:2');
    expect(applyPathSwapEditsToPath('1:1:1:2', edits)).toBe('1:2:1:2');
    expect(applyPathSwapEditsToPath('1:2:3', edits)).toBe('1:1:3');
    expect(applyPathSwapEditsToPath('1:10:3', edits)).toBe('1:10:3');
  });

  it('invalidates both old and new cache keys for moved deep descendants', () => {
    const invalidation = mergePathSwapInvalidation(
      {
        textAndMediaPaths: ['1:1:1:2'],
        translationPaths: [{ lang_id: 7, path: '1:1:1:2' }]
      },
      {
        textAndMediaPaths: ['1:2:1:2'],
        translationPaths: [{ lang_id: 7, path: '1:2:1:2' }]
      }
    );

    expect(buildRedisKeysForPathSwapInvalidation(42, invalidation).sort()).toEqual(
      [
        'media_links:42:1/1/1/2',
        'media_links:42:1/2/1/2',
        'text_data:42:1/1/1/2',
        'text_data:42:1/2/1/2',
        'trans_data:42:7:1/1/1/2',
        'trans_data:42:7:1/2/1/2'
      ].sort()
    );
  });
});
