import { describe, expect, it } from 'vitest';
import { transliterate } from 'lipilekhika';
import {
  stripLipiTagsFromHtml,
  stripLipiTagsFromMarkdown,
  transliterateLipiSpansInMarkdown,
  transliterateWholeMarkdown,
  LIPI_SPAN_CLASS
} from './lipiMarkdown';
import { renderLekhaMarkdownToHtml } from '~/lib/carta_markdown/markdown';
import type { script_list_type } from '~/state/lang_list';

/** Deterministic preview: bypass real transliteration. */
// SAFETY: test stub bypasses real transliteration — for string input transliterate's output is
// Promise<string>, so this (text) => Promise<string> stub matches the call shape used under test.
const identityTransliterate = (async (text: string) => text) as typeof transliterate;

const script: script_list_type = 'Devanagari';

describe('transliterateLipiSpansInMarkdown', () => {
  it('handles single lipi with shloka tag inside', async () => {
    const out = await transliterateLipiSpansInMarkdown(
      `<lipi><shloka>अ</shloka></lipi>`,
      script,
      identityTransliterate
    );
    expect(out).toContain(`<div class="${LIPI_SPAN_CLASS}">`);
    expect(out).not.toContain(`<p class="${LIPI_SPAN_CLASS}">`);
    expect(out).toContain('<shloka>');
    expect(out).not.toContain('<lipi>');
  });

  it('wraps lipi without shloka in div', async () => {
    const out = await transliterateLipiSpansInMarkdown(
      `before <lipi>अ</lipi> after`,
      script,
      identityTransliterate
    );
    expect(out).toContain(`<span class="${LIPI_SPAN_CLASS}">`);
    expect((out.match(/site_lipi_text_md/g) ?? []).length).toBe(1);
    expect(out).toContain('before ');
    expect(out).toContain(' after');
    expect(out).not.toContain('<lipi>');
    expect(out).not.toContain('<p class=');
  });

  it('wraps lipi with blank-line inner matter but no shloka tag still in div', async () => {
    const inner = `line\n\n`;
    const out = await transliterateLipiSpansInMarkdown(
      `<lipi>${inner}a</lipi>`,
      script,
      identityTransliterate
    );
    expect(out).toContain(`<div class="${LIPI_SPAN_CLASS}">`);
    expect(out).toContain(inner);
    expect(out).toContain('a');
  });

  it('wraps lipi containing shloka in p', async () => {
    const md = `<lipi><shloka>line\n</shloka></lipi>`;
    const out = await transliterateLipiSpansInMarkdown(md, script, identityTransliterate);
    expect(out).toContain(`<div class="${LIPI_SPAN_CLASS}">`);
    expect(out).toContain('<shloka>');
    expect(out).not.toContain('<lipi>');
  });

  it('matches each lipi block independently (pairs do not swallow content between blocks)', async () => {
    const md = `# H\n\n<lipi>one</lipi>\n\n## Between\n\n<lipi>two</lipi>`;
    const out = await transliterateLipiSpansInMarkdown(md, script, identityTransliterate);
    const wrappers = [...out.matchAll(/<(div|p) class="site_lipi_text_md">/g)];
    expect(wrappers).toHaveLength(0);
    expect(out.indexOf('one')).toBeLessThan(out.indexOf('Between'));
    expect(out.indexOf('Between')).toBeLessThan(out.indexOf('two'));
  });
});

describe('stripLipiTagsFromHtml', () => {
  it('strips orphaned lipi tags from HTML', () => {
    expect(stripLipiTagsFromHtml('<p>x<lipi>y</lipi>z</p>')).toBe('<p>xyz</p>');
  });
});

describe('stripLipiTagsFromMarkdown', () => {
  it('removes lipi wrappers and leaves lipi-shloka tags alone', () => {
    expect(stripLipiTagsFromMarkdown('<lipi>अ</lipi> <lipi-shloka>ब</lipi-shloka>')).toBe(
      'अ <lipi-shloka>ब</lipi-shloka>'
    );
    expect(stripLipiTagsFromMarkdown('<LiPi class="x">क</LiPi>')).toBe('क');
  });
});

/** Records the exact payload handed to lipilekhika and rewrites two letters. */
function recordingTransliterate() {
  const calls: Array<string | string[]> = [];
  const map = (text: string) => text.replaceAll('अ', 'A').replaceAll('क', 'K');
  // SAFETY: test stub matches transliterate's call shape — string in, string out, or string[] in, string[] out.
  const fn = (async (text: string | string[]) => {
    calls.push(text);
    return Array.isArray(text) ? text.map(map) : map(text);
  }) as typeof transliterate;
  return { fn, calls };
}

describe('transliterateWholeMarkdown', () => {
  it('strips lipi tags and transliterates the remaining markdown as one string', async () => {
    const { fn, calls } = recordingTransliterate();
    const out = await transliterateWholeMarkdown(
      'outside अ <lipi>क</lipi> <shloka>अ</shloka>',
      script,
      fn
    );
    expect(calls).toEqual(['outside अ क <shloka>अ</shloka>']);
    expect(out).toBe('outside A K <shloka>A</shloka>');
    expect(out).not.toContain('<lipi');
  });
});

describe('renderLekhaMarkdownToHtml (lipi)', () => {
  it('does not lump following headings into the first lipi block when multiple shloka blocks nest inside lipi', async () => {
    const md = `## Vyasa section

<lipi>
<shloka>
line a
line b
</shloka>

<shloka>
line c
</shloka>
</lipi>

## Next section title

**bold**

<lipi>x</lipi>`;

    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });

    expect(html.match(/<h2\b/g)?.length ?? 0).toBe(2);

    expect(html.indexOf('Vyasa')).toBeLessThan(html.indexOf('Next section title'));

    const markerCount = (html.match(new RegExp(LIPI_SPAN_CLASS, 'g')) ?? []).length;
    expect(markerCount).toBeGreaterThanOrEqual(2);
  });

  it('with auto transliterate off, only lipi inners are sent to the transliterator', async () => {
    const { fn, calls } = recordingTransliterate();
    const md = ['outside अ', '', '<lipi>क</lipi>', '', '<lipi>अ</lipi>'].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: fn,
      skipSourceSanitization: true,
      autoTransliterateContent: false
    });
    expect(calls).toEqual([['क', 'अ']]);
    expect(html).toContain('outside अ');
    expect(html).not.toContain('outside A');
    expect(html).toContain('K');
    expect(html).toContain(`class="${LIPI_SPAN_CLASS}"`);
  });

  it('with auto transliterate on, transliterates one block after lipi-shloka expand and lipi strip', async () => {
    const { fn, calls } = recordingTransliterate();
    const md = [
      'outside अ',
      '',
      '<lipi>क</lipi>',
      '',
      '<lipi-shloka>',
      'अ',
      'ब',
      '</lipi-shloka>'
    ].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: fn,
      skipSourceSanitization: true,
      autoTransliterateContent: true
    });

    expect(calls).toHaveLength(1);
    const passed = calls[0];
    if (passed == null || Array.isArray(passed)) {
      throw new Error('expected one markdown string');
    }
    expect(passed).toContain('outside अ');
    expect(passed).toContain('क');
    expect(passed).toContain('<shloka>');
    expect(passed).not.toContain('<lipi-shloka>');
    expect(passed).not.toMatch(/<\s*\/?\s*lipi(?![\w-])/i);

    expect(html).toContain('outside A');
    expect(html).toContain('K');
    expect(html).toContain('A<br');
    expect(html).toContain('ब');
    expect(html).not.toContain('<lipi');
    expect(html).not.toContain('site_lipi_text_md');
    expect(html).not.toContain('<shloka');
  });
});
