import { describe, expect, it } from 'vitest';
import {
  format_download_text,
  format_shloka_block,
  get_import_format_example,
  get_import_format_hint,
  MISSING_TRANSLATION,
  parse_import_text,
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
      format_download_text(['लिपि २', 'लिपि १'], ['lipi 2', 'lipi 1'], [0, 1], null, {
        textScript: 'Devanagari',
        includeNormal: true,
        includeTranslation: false
      })
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

  it('parses text and normal transliteration without translation', () => {
    expect(
      parse_import_text(
        `लिपि २
lipi 2

लिपि १
lipi 1`,
        { includesNormal: true, includesTranslation: false }
      )
    ).toEqual({
      rows: [
        { text: 'लिपि २', normal: 'lipi 2' },
        { text: 'लिपि १', normal: 'lipi 1' }
      ],
      ignoredBlockCount: 0
    });
  });

  it('parses multiline text, normal transliteration, and translation', () => {
    const input = `स तत्र न्यवसद् भ्रात्रा सह सत्कारसत्कृतः ।
मातुलेनाश्वपतिना पुत्रस्नेहेन लालितः ॥२-१-२॥
sa tatra nyavasad bhrAtrA saha satkArasatkRtaH
mAtulEnAshvapatinA putrasnEhEna lAlitaH 2-1-2

There he dwelt together with his brother, honoured and duly received; and by his maternal uncle, the lord of horses (Aśvapati), he was cherished with a father’s fondness.`;

    expect(parse_import_text(input, { includesNormal: true, includesTranslation: true })).toEqual({
      rows: [
        {
          text: 'स तत्र न्यवसद् भ्रात्रा सह सत्कारसत्कृतः ।\nमातुलेनाश्वपतिना पुत्रस्नेहेन लालितः ॥२-१-२॥',
          normal:
            'sa tatra nyavasad bhrAtrA saha satkArasatkRtaH\nmAtulEnAshvapatinA putrasnEhEna lAlitaH 2-1-2',
          translation:
            'There he dwelt together with his brother, honoured and duly received; and by his maternal uncle, the lord of horses (Aśvapati), he was cherished with a father’s fondness.'
        }
      ],
      ignoredBlockCount: 0
    });
  });

  it('trims redundant leading and trailing spaces per line', () => {
    expect(
      parse_import_text(
        `  लिपि २  
  lipi 2  

  Translation text  `,
        { includesNormal: true, includesTranslation: true }
      )
    ).toEqual({
      rows: [{ text: 'लिपि २', normal: 'lipi 2', translation: 'Translation text' }],
      ignoredBlockCount: 0
    });
  });

  it('omits translation when the translation section is a missing marker', () => {
    expect(
      parse_import_text(
        `लिपि २
lipi 2

-----`,
        { includesNormal: true, includesTranslation: true }
      )
    ).toEqual({
      rows: [{ text: 'लिपि २', normal: 'lipi 2' }],
      ignoredBlockCount: 0
    });
  });

  it('skips incomplete trailing blocks and reports them', () => {
    expect(
      parse_import_text(
        `लिपि २
lipi 2

Script two

लिपि १
lipi 1`,
        { includesNormal: true, includesTranslation: true }
      )
    ).toEqual({
      rows: [{ text: 'लिपि २', normal: 'lipi 2', translation: 'Script two' }],
      ignoredBlockCount: 1
    });
  });

  it('skips malformed main sections between valid blocks', () => {
    expect(
      parse_import_text(
        `लिपि २
lipi 2

Script two

only text without normal

Malformed translation

लिपि ३
lipi 3

Script three`,
        { includesNormal: true, includesTranslation: true }
      )
    ).toEqual({
      rows: [
        { text: 'लिपि २', normal: 'lipi 2', translation: 'Script two' },
        { text: 'लिपि ३', normal: 'lipi 3', translation: 'Script three' }
      ],
      ignoredBlockCount: 1
    });
  });

  it('parses text with translation when normal is not included', () => {
    expect(
      parse_import_text(
        `लिपि २

Script two`,
        { includesNormal: false, includesTranslation: true }
      )
    ).toEqual({
      rows: [{ text: 'लिपि २', translation: 'Script two' }],
      ignoredBlockCount: 0
    });
  });

  it('builds import format example from checkbox options', () => {
    expect(get_import_format_example({ includesNormal: true, includesTranslation: true }))
      .toBe(`ॐ श्री परमात्मने नमः
AUM shrI paramAtmane namaH

I bow down to the supreme consciousness`);

    expect(get_import_format_example({ includesNormal: true, includesTranslation: false })).toBe(
      `ॐ श्री परमात्मने नमः
AUM shrI paramAtmane namaH`
    );

    expect(get_import_format_example({ includesNormal: false, includesTranslation: true })).toBe(
      `ॐ श्री परमात्मने नमः

I bow down to the supreme consciousness`
    );

    expect(get_import_format_example({ includesNormal: false, includesTranslation: false })).toBe(
      'ॐ श्री परमात्मने नमः'
    );
  });

  it('builds import format hint from checkbox options', () => {
    expect(get_import_format_hint({ includesNormal: false, includesTranslation: false })).toBe(
      'Each block is one text entry. Separate multiple blocks with a blank line.'
    );
    expect(get_import_format_hint({ includesNormal: false, includesTranslation: true })).toBe(
      'Each entry is a text block followed by its translation, separated by a blank line.'
    );
    expect(get_import_format_hint({ includesNormal: true, includesTranslation: false })).toBe(
      'Each block has the same number of script and normal transliteration lines.'
    );
    expect(get_import_format_hint({ includesNormal: true, includesTranslation: true })).toBe(
      'Each entry is script text, normal transliteration, then translation. Leave a blank line before the translation and between entries.'
    );
  });
});
