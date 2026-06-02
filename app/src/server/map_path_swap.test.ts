import { describe, expect, it } from 'vitest';
import { toTempDbPath, validateDbPath, validateSwapEdits, validateSwapPair } from './map_path_swap';

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

  it('builds temp paths', () => {
    expect(toTempDbPath('1:2')).toBe('1:2_temp');
  });
});
