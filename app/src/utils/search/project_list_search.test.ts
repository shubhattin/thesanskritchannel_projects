import { describe, expect, it } from 'vitest';
import {
  all_words_match_in_fields,
  project_matches_search,
  tokenize_search_query,
  word_matches_text
} from './project_list_search';

describe('project_list_search', () => {
  it('tokenizes query into lowercase words', () => {
    expect(tokenize_search_query('  Rāma   Ayana ')).toEqual(['rāma', 'ayana']);
    expect(tokenize_search_query('')).toEqual([]);
  });

  it('matches words case-insensitively', () => {
    expect(word_matches_text('rama', 'rAmAyaNam')).toBe(true);
    expect(word_matches_text('ayana', 'rAmAyaNam')).toBe(true);
    expect(word_matches_text('bhagavad', 'Bhagavad Gita')).toBe(true);
  });

  it('requires every word to match across searchable fields', () => {
    expect(all_words_match_in_fields(['rama', 'ayana'], ['rAmAyaNam'])).toBe(true);
    expect(all_words_match_in_fields(['rama', 'gita'], ['rAmAyaNam'])).toBe(false);
    expect(all_words_match_in_fields(['bhagavad', 'gita'], ['Bhagavad Gita', 'भगवद्गीता'])).toBe(
      true
    );
  });

  it('matches projects using name, devanagari, description, and normal transliteration', () => {
    const project = {
      name: 'Ramayana',
      name_dev: 'रामायणम्',
      description: 'Epic poem'
    };

    expect(project_matches_search(project, tokenize_search_query('ramayana'), undefined)).toBe(
      true
    );
    expect(project_matches_search(project, tokenize_search_query('राम'), undefined)).toBe(true);
    expect(project_matches_search(project, tokenize_search_query('rama ayana'), 'rAmAyaNam')).toBe(
      true
    );
    expect(project_matches_search(project, tokenize_search_query('epic poem'), undefined)).toBe(
      true
    );
    expect(project_matches_search(project, tokenize_search_query('mahabharata'), undefined)).toBe(
      false
    );
  });
});
