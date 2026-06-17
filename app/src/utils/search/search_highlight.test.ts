import { describe, expect, it } from 'vitest';
import { build_sanitized_text_index_map, split_text_by_search_query } from './search_highlight';

describe('build_sanitized_text_index_map', () => {
  it('skips vedic svara marks when building the sanitized view', () => {
    const { sanitized, sanitizedStarts } = build_sanitized_text_index_map('अ॒ग्निम्');
    expect(sanitized).toBe('अग्निम्');
    expect(sanitizedStarts).toHaveLength(sanitized.length);
    expect(sanitizedStarts[0]).toBe(0);
    expect(sanitizedStarts[1]).toBe(2);
  });
});

describe('split_text_by_search_query', () => {
  it('highlights plain matches unchanged', () => {
    expect(split_text_by_search_query('अशोच्यान्', 'अशोच्य')).toEqual([
      { text: 'अशोच्य', highlight: true },
      { text: 'ान्', highlight: false }
    ]);
  });

  it('highlights vedic text using a plain query', () => {
    const text = 'अ॒शो॑च्यान्वशोचस्त्वं';
    const segments = split_text_by_search_query(text, 'अशोच्य');
    expect(segments).toEqual([
      { text: 'अ॒शो॑च्य', highlight: true },
      { text: 'ान्वशोचस्त्वं', highlight: false }
    ]);
  });

  it('highlights when the query itself contains svara marks', () => {
    const segments = split_text_by_search_query('अग्निम्', 'अ॒ग्नि');
    expect(segments).toEqual([
      { text: 'अग्नि', highlight: true },
      { text: 'म्', highlight: false }
    ]);
  });

  it('finds multiple sanitized matches in the same line', () => {
    const segments = split_text_by_search_query('अ॒ग्निम् अग्निम्', 'अग्नि');
    expect(segments).toEqual([
      { text: 'अ॒ग्नि', highlight: true },
      { text: 'म् ', highlight: false },
      { text: 'अग्नि', highlight: true },
      { text: 'म्', highlight: false }
    ]);
  });
});
