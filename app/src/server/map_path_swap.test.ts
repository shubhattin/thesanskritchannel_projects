import { describe, expect, it } from 'vitest';
import {
  buildPathSwapSteps,
  dbPathToPathParams,
  toTempDbPath,
  validateDbPath,
  validateSwapEdits,
  validateSwapPair
} from './map_path_swap';

describe('map_path_swap', () => {
  it('validates db path segments', () => {
    expect(validateDbPath('1:2:3')).toBeNull();
    expect(validateDbPath('')).not.toBeNull();
    expect(validateDbPath('1:0')).not.toBeNull();
    expect(validateDbPath('1:2_temp')).not.toBeNull();
  });

  it('requires sibling paths at same depth', () => {
    expect(validateSwapPair('1:2', '1:5')).toBeNull();
    expect(validateSwapPair('1:2', '1:2')).not.toBeNull();
    expect(validateSwapPair('1:2', '2:2')).not.toBeNull();
    expect(validateSwapPair('1:2', '1:2:3')).not.toBeNull();
  });

  it('validates edit list', () => {
    expect(
      validateSwapEdits([{ swap_paths: ['2:1', '2:3'] }, { swap_paths: ['2:2', '2:4'] }])
    ).toBeNull();
  });

  it('rejects malformed swap entries', () => {
    expect(validateSwapEdits([{ swap_paths: ['2:1', '2:3', '2:4'] as any }] as any)).toBe(
      'Swap 1: swap_paths must be a tuple of two paths'
    );
  });

  it('builds temp paths', () => {
    expect(toTempDbPath('1:2')).toBe('1:2_temp');
  });

  it('builds ordered single-stage swap steps', () => {
    expect(buildPathSwapSteps('1', '2')).toEqual([
      { from_path: '1', to_path: '2_temp' },
      { from_path: '2', to_path: '1' },
      { from_path: '2_temp', to_path: '2' }
    ]);
  });

  it('rejects invalid db paths when building cache params', () => {
    expect(() => dbPathToPathParams('1:bad')).toThrow('Invalid DB path "1:bad"');
  });
});
