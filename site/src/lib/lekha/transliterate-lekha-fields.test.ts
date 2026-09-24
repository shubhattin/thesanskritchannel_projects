import { describe, expect, it } from 'vitest';
import { transliterate_lekha_fields } from './transliterate-lekha-fields';

const rows = [
  {
    title: 'रामः',
    description: 'गीता',
    auto_transliterate_title: true,
    auto_transliterate_description: true
  },
  {
    title: 'English',
    description: '',
    auto_transliterate_title: true,
    auto_transliterate_description: true
  },
  {
    title: 'शिवः',
    description: 'note',
    auto_transliterate_title: false,
    auto_transliterate_description: false
  }
];

describe('transliterate_lekha_fields', () => {
  it('returns nulls and skips the transliterator when the list helper returns null', async () => {
    let calls = 0;
    const out = await transliterate_lekha_fields(rows, 1, async () => {
      calls += 1;
      return null;
    });
    expect(calls).toBe(1);
    expect(out.map((row) => row.title_transliterated)).toEqual([null, null, null]);
    expect(out.map((row) => row.description_transliterated)).toEqual([null, null, null]);
  });

  it('does not call the transliterator when no field is eligible', async () => {
    let calls = 0;
    const out = await transliterate_lekha_fields(
      [
        {
          title: 'शिवः',
          description: 'x',
          auto_transliterate_title: false,
          auto_transliterate_description: false
        }
      ],
      12,
      async () => {
        calls += 1;
        return ['nope'];
      }
    );
    expect(calls).toBe(0);
    expect(out[0]?.title_transliterated).toBeNull();
    expect(out[0]?.description_transliterated).toBeNull();
  });

  it('sends eligible title and description strings in one list and drops unchanged results', async () => {
    const seen: string[][] = [];
    const out = await transliterate_lekha_fields(rows, 12, async (text) => {
      seen.push(text);
      return text.map((value) => (value === 'English' ? value : `${value}-x`));
    });
    expect(seen).toEqual([['रामः', 'गीता', 'English']]);
    expect(out[0]).toMatchObject({
      title_transliterated: 'रामः-x',
      description_transliterated: 'गीता-x'
    });
    expect(out[1]?.title_transliterated).toBeNull();
    expect(out[2]?.title_transliterated).toBeNull();
    expect(out[2]?.description_transliterated).toBeNull();
  });
});
