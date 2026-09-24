import { describe, expect, it } from 'vitest';
import { lekha_has_script_selector } from './lekha-script-indicator';

const base = {
  title: 'English title',
  description: 'English description',
  content: 'English body',
  auto_transliterate_title: true,
  auto_transliterate_description: true,
  auto_transliterate_content: true
};

describe('lekha_has_script_selector', () => {
  it('is false when nothing is Devanagari', () => {
    expect(lekha_has_script_selector(base)).toBe(false);
  });

  it('detects Devanagari in title and description only when those flags are on', () => {
    expect(lekha_has_script_selector({ ...base, title: 'रामः' })).toBe(true);
    expect(
      lekha_has_script_selector({ ...base, title: 'रामः', auto_transliterate_title: false })
    ).toBe(false);
    expect(lekha_has_script_selector({ ...base, description: 'गीता' })).toBe(true);
    expect(
      lekha_has_script_selector({
        ...base,
        description: 'गीता',
        auto_transliterate_description: false
      })
    ).toBe(false);
  });

  it('uses whole-content Devanagari when content auto-transliteration is on', () => {
    expect(lekha_has_script_selector({ ...base, content: 'verse रामः' })).toBe(true);
    expect(
      lekha_has_script_selector({
        ...base,
        content: 'verse रामः',
        auto_transliterate_content: false
      })
    ).toBe(false);
  });

  it('keeps lipi and lipi-shloka markers when content auto-transliteration is off', () => {
    expect(
      lekha_has_script_selector({
        ...base,
        auto_transliterate_content: false,
        content: 'see <lipi>text</lipi>'
      })
    ).toBe(true);
    expect(
      lekha_has_script_selector({
        ...base,
        auto_transliterate_content: false,
        content: '<lipi-shloka>\nline\n</lipi-shloka>'
      })
    ).toBe(true);
  });
});
