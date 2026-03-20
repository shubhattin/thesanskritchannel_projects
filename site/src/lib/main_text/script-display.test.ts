import { describe, expect, it } from 'vitest';
import {
  get_display_script_from_id,
  transliterate_for_display,
  transliterate_list_for_display
} from './script-display';

describe('script-display', () => {
  it('maps script ids to display script labels', () => {
    expect(get_display_script_from_id(1)).toBe('Devanagari');
    expect(get_display_script_from_id(12)).toBe('Romanized');
  });

  it('returns original text for the default script', async () => {
    await expect(transliterate_for_display('रामः', 1)).resolves.toBe('रामः');
    await expect(transliterate_list_for_display(['रामः', 'नमः'], 1)).resolves.toEqual([
      'रामः',
      'नमः'
    ]);
  });

  it('transliterates text for non-default scripts', async () => {
    const romanized = await transliterate_for_display('रामः', 12);
    expect(romanized).not.toBe('रामः');
    expect(/[\u0900-\u097f]/i.test(romanized)).toBe(false);
  });
});
