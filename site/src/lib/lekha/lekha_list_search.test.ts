import { describe, expect, it } from 'vitest';
import { filter_lekhas_by_search } from './lekha_list_search';

const posts = [
  {
    title: 'रामायणम्',
    description: 'महर्षेः कृतिः',
    tags: ['काव्य'],
    title_transliterated: 'రామాయణమ్',
    description_transliterated: null
  }
];

const normal_of = (text: string) => {
  if (text === 'रामायणम्') return 'rAmAyaNam';
  if (text === 'महर्षेः कृतिः') return 'maharSeH kRtiH';
  if (text === 'काव्य') return 'kAvya';
  return undefined;
};

describe('filter_lekhas_by_search', () => {
  it('matches latin, iast, and devanagari against the original fields', () => {
    expect(filter_lekhas_by_search(posts, 'rama ayana', normal_of)).toHaveLength(1);
    expect(filter_lekhas_by_search(posts, 'rāmāyaṇa', normal_of)).toHaveLength(1);
    expect(filter_lekhas_by_search(posts, 'राम', normal_of)).toHaveLength(1);
    expect(filter_lekhas_by_search(posts, 'kavya', normal_of)).toHaveLength(1);
    expect(filter_lekhas_by_search(posts, 'mahabharata', normal_of)).toHaveLength(0);
  });

  it('matches the selected script from display text or from a normal query form', () => {
    expect(filter_lekhas_by_search(posts, 'రామ', normal_of)).toHaveLength(1);
    const without_display = posts.map((post) => ({ ...post, title_transliterated: null }));
    expect(filter_lekhas_by_search(without_display, 'రామాయణమ్', normal_of)).toHaveLength(0);
    expect(
      filter_lekhas_by_search(without_display, 'రామాయణమ్', normal_of, {
        normals: ['rAmAyaNam']
      })
    ).toHaveLength(1);
  });

  it('fuzzy-matches a short title and not a description typo', () => {
    expect(filter_lekhas_by_search(posts, 'ramayna', normal_of)).toHaveLength(1);
    expect(filter_lekhas_by_search(posts, 'mahrseh', normal_of)).toHaveLength(0);
  });
});
