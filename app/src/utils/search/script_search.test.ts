import { describe, expect, it } from 'vitest';
import { fold_search_text } from './fold_search_text';
import { fuzzy_includes } from './fuzzy_includes';
import { normal_source_for_query_word } from './query_word_script';

describe('fold_search_text', () => {
  it('folds latin case and diacritics without touching brahmic signs', () => {
    expect(fold_search_text('Rāma')).toBe('rama');
    expect(fold_search_text('rāmāyaṇa')).toBe('ramayana');
    expect(fold_search_text('कि')).toBe('कि');
    expect(fold_search_text('रा॑मः')).toBe('रामः');
    expect(fold_search_text(fold_search_text('rāma कि'))).toBe(fold_search_text('rāma कि'));
  });
});

describe('fuzzy_includes', () => {
  it('allows a single edit inside a name and rejects distant strings', () => {
    expect(fuzzy_includes('ramayana', 'ramayna', 1)).toBe(true);
    expect(fuzzy_includes('ramayanam', 'rama', 1)).toBe(true);
    expect(fuzzy_includes('ramayanam', 'xyzq', 1)).toBe(false);
    expect(fuzzy_includes('gita', 'git', 0)).toBe(true);
    expect(fuzzy_includes('gita', 'gix', 0)).toBe(false);
  });
});

describe('normal_source_for_query_word', () => {
  it('keeps latin as a direct roman query', () => {
    expect(normal_source_for_query_word('rama', 'Telugu')).toBeNull();
    expect(normal_source_for_query_word('rāma', 'Telugu')).toBeNull();
  });

  it('reads devanagari from the characters even when another script is selected', () => {
    expect(normal_source_for_query_word('राम', 'Telugu')).toBe('Devanagari');
    expect(normal_source_for_query_word('राम', 'Devanagari')).toBe('Devanagari');
  });

  it('uses the word’s own block, and the selected script only as a tie-break', () => {
    expect(normal_source_for_query_word('రామ', 'Kannada')).toBe('Telugu');
    expect(normal_source_for_query_word('রম', 'Assamese')).toBe('Assamese');
    expect(normal_source_for_query_word('ரம', 'Tamil-Extended')).toBe('Tamil-Extended');
    expect(normal_source_for_query_word('ரம', 'Telugu')).toBe('Tamil');
  });
});
