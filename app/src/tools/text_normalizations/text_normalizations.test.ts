import { describe, expect, it } from 'vitest';
import {
  apply_normalizations_to_texts,
  apply_single_normalization_to_texts,
  DEFAULT_ENABLED_NORMALIZATIONS
} from './index';

describe('text_normalizations', () => {
  it('replaces colon with visarga', () => {
    expect(
      apply_single_normalization_to_texts(
        ['राम:', 'no change'],
        [0, 1],
        'replace_colon_with_visarga'
      )
    ).toEqual(['रामः', 'no change']);
  });

  it('collapses extra spaces', () => {
    expect(
      apply_single_normalization_to_texts(
        ['  word   word  '],
        [0],
        'remove_extra_spaces_and_collapse_single'
      )
    ).toEqual(['word word']);
  });

  it('replaces double and single bars in order', () => {
    const texts = ['|| 1 | 2'];
    expect(
      apply_normalizations_to_texts(
        texts,
        [0],
        ['replace_double_bar_with_purna_virama', 'replace_single_bar_with_virama']
      )
    ).toEqual(['॥ 1 । 2']);
  });

  it('removes spaces around numbers between double virama', () => {
    expect(
      apply_single_normalization_to_texts(
        ['॥ १७ ॥'],
        [0],
        'remove_space_when_number_between_double_virama'
      )
    ).toEqual(['॥१७॥']);
  });

  it('applies default pipeline to selected indices only', () => {
    const texts = ['|| १७ || :', 'skip me'];
    expect(apply_normalizations_to_texts(texts, [0], DEFAULT_ENABLED_NORMALIZATIONS)).toEqual([
      '॥१७॥ ः',
      'skip me'
    ]);
  });

  it('runs normalizations in execution order regardless of input order', () => {
    const texts = ['|| | :'];
    expect(
      apply_normalizations_to_texts(
        texts,
        [0],
        [
          'replace_single_bar_with_virama',
          'replace_double_bar_with_purna_virama',
          'replace_colon_with_visarga'
        ]
      )
    ).toEqual(['॥ । ः']);
  });
});
