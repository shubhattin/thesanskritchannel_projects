import { describe, expect, it } from 'vitest';
import {
  all_words_match_in_fields,
  filter_projects_by_search,
  project_matches_search,
  tokenize_search_query,
  word_matches_text
} from './project_list_search';

describe('project_list_search', () => {
  it('tokenizes query into folded words', () => {
    expect(tokenize_search_query('  Rāma   Ayana ')).toEqual(['rama', 'ayana']);
    expect(tokenize_search_query('')).toEqual([]);
    expect(tokenize_search_query('रामः')).toEqual(['रामः']);
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
    expect(project_matches_search(project, tokenize_search_query('rāmāyaṇa'), 'rAmAyaNam')).toBe(
      true
    );
    expect(project_matches_search(project, tokenize_search_query('ramayna'), 'rAmAyaNam')).toBe(
      true
    );
    expect(project_matches_search(project, tokenize_search_query('xyzq'), 'rAmAyaNam')).toBe(false);
    expect(project_matches_search(project, tokenize_search_query('epik'), undefined)).toBe(false);
  });

  it('matches a selected-script query through its normal form and through display text', () => {
    const project = {
      name: 'Ramayana',
      name_dev: 'रामायणम्',
      description: 'Epic poem'
    };
    const telugu = tokenize_search_query('రామాయణమ్');

    expect(project_matches_search(project, telugu, 'rAmAyaNam')).toBe(false);
    expect(
      project_matches_search(project, telugu, 'rAmAyaNam', {
        query_normals: ['rAmAyaNam']
      })
    ).toBe(true);
    expect(
      project_matches_search(project, telugu, undefined, {
        name_dev_display: 'రామాయణమ్'
      })
    ).toBe(true);
    expect(project_matches_search(project, tokenize_search_query('राम'), undefined)).toBe(true);
  });

  it('does not fuzzy-match a devanagari syllable onto a different word', () => {
    const deva = { name: 'Deva', name_dev: 'देव', description: 'A deity' };
    expect(
      project_matches_search(deva, tokenize_search_query('केव'), 'dEva', {
        query_normals: ['kEva']
      })
    ).toBe(false);

    const lipi = { name: 'Lipi', name_dev: 'लिपि', description: 'eclipse of the text' };
    expect(
      project_matches_search(lipi, tokenize_search_query('लिप्'), 'lipi', {
        query_normals: ['lip']
      })
    ).toBe(false);

    const kevalam = { name: 'Kevalam', name_dev: 'केवलम्', description: null };
    expect(
      project_matches_search(kevalam, tokenize_search_query('केव'), 'kEvalam', {
        query_normals: ['kEva']
      })
    ).toBe(true);
  });

  it('ranks a name match ahead of a description mention', () => {
    const projects = [
      { name: 'Other', name_dev: 'अन्य', description: 'a note that mentions ramayana' },
      { name: 'Ramayana', name_dev: 'रामायणम्', description: 'Epic' }
    ];
    expect(
      filter_projects_by_search(projects, 'ramayana', () => undefined).map(
        (project) => project.name
      )
    ).toEqual(['Ramayana', 'Other']);
  });

  it('ranking does not bring a different devanagari word back in', () => {
    const projects = [
      { name: 'Deva', name_dev: 'देव', description: 'A deity' },
      { name: 'Kevalam', name_dev: 'केवलम्', description: null }
    ];
    expect(
      filter_projects_by_search(
        projects,
        'केव',
        (name_dev) => (name_dev === 'केवलम्' ? 'kEvalam' : 'dEva'),
        { query_normals: ['kEva'] }
      ).map((project) => project.name)
    ).toEqual(['Kevalam']);
  });
});
