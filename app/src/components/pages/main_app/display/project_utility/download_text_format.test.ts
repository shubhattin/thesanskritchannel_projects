import { describe, expect, it } from 'vitest';
import {
  format_download_text,
  format_shloka_block,
  MISSING_TRANSLATION,
  should_show_normal_transliteration
} from './download_text_format';

describe('download_text_format', () => {
  it('formats script with normal transliteration below', () => {
    expect(
      format_shloka_block('लिपि २', 'lipi 2', null, {
        includeNormal: true,
        includeTranslation: false
      })
    ).toBe('लिपि २\nlipi 2');
  });

  it('joins shloka blocks with a blank line', () => {
    expect(
      format_download_text(
        ['लिपि २', 'लिपि १'],
        ['lipi 2', 'lipi 1'],
        [0, 1],
        null,
        {
          textScript: 'Devanagari',
          includeNormal: true,
          includeTranslation: false
        }
      )
    ).toBe('लिपि २\nlipi 2\n\nलिपि १\nlipi 1');
  });

  it('includes a blank line between normal transliteration and translation', () => {
    const translationMap = new Map<number, string>([[0, 'Script two']]);

    expect(
      format_download_text(['लिपि २'], ['lipi 2'], [0], translationMap, {
        textScript: 'Devanagari',
        includeNormal: true,
        includeTranslation: true
      })
    ).toBe('लिपि २\nlipi 2\n\nScript two');
  });

  it('formats multiline shlokas with a blank line before translation', () => {
    const scriptText =
      'स तत्र न्यवसद् भ्रात्रा सह सत्कारसत्कृतः ।\nमातुलेनाश्वपतिना पुत्रस्नेहेन लालितः ॥२-१-२॥';
    const normalText =
      'sa tatra nyavasad bhrAtrA saha satkArasatkRtaH \nmAtulEnAshvapatinA putrasnEhEna lAlitaH 2-1-2';
    const translationText =
      'There he dwelt together with his brother, honoured and duly received; and by his maternal uncle, the lord of horses (Aśvapati), he was cherished with a father’s fondness.';

    expect(
      format_shloka_block(scriptText, normalText, translationText, {
        includeNormal: true,
        includeTranslation: true
      })
    ).toBe(`${scriptText}\n${normalText}\n\n${translationText}`);
  });

  it('separates consecutive shlokas with a blank line when normal and translation are included', () => {
    const first = format_shloka_block('श्लोक १', 'shloka 1', 'First translation', {
      includeNormal: true,
      includeTranslation: true
    });
    const second = format_shloka_block('श्लोक २', 'shloka 2', 'Second translation', {
      includeNormal: true,
      includeTranslation: true
    });

    expect(
      format_download_text(
        ['श्लोक १', 'श्लोक २'],
        ['shloka 1', 'shloka 2'],
        [0, 1],
        new Map([
          [0, 'First translation'],
          [1, 'Second translation']
        ]),
        {
          textScript: 'Devanagari',
          includeNormal: true,
          includeTranslation: true
        }
      )
    ).toBe(`${first}\n\n${second}`);
  });

  it('joins script and translation with a single newline when normal is omitted', () => {
    expect(
      format_shloka_block('लिपि २', null, 'Script two', {
        includeNormal: false,
        includeTranslation: true
      })
    ).toBe('लिपि २\nScript two');
  });

  it('uses missing translation placeholder when translation is absent', () => {
    expect(
      format_shloka_block('लिपि २', 'lipi 2', undefined, {
        includeNormal: true,
        includeTranslation: true
      })
    ).toBe(`लिपि २\nlipi 2\n\n${MISSING_TRANSLATION}`);
  });

  it('hides normal transliteration option for Normal and Romanized scripts', () => {
    expect(should_show_normal_transliteration('Devanagari')).toBe(true);
    expect(should_show_normal_transliteration('Normal')).toBe(false);
    expect(should_show_normal_transliteration('Romanized')).toBe(false);
  });
});
