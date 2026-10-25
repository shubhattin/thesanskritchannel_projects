import { describe, expect, it } from 'vitest';
import { LANG_LIST, LANG_LIST_IDS } from '~/state/lang_list';
import { buildLanguagesContext } from './languages';

describe('buildLanguagesContext', () => {
  it('lists every language id with its script', () => {
    const text = buildLanguagesContext();
    const rows = LANG_LIST.map((name, index) => `| ${LANG_LIST_IDS[index]} | ${name} |`);
    expect(rows.filter((row) => !text.includes(row))).toEqual([]);
    expect(text).toContain('| 3 | Hindi | Devanagari |');
    expect(text).toContain('| 1 | English | Latin |');
  });
});
