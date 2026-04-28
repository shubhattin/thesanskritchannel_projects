import { describe, expect, it } from 'vitest';
import { transliterate } from 'lipilekhika';
import {
  stripLipiTagsFromHtml,
  transliterateLipiSpansInMarkdown,
  LIPI_SPAN_CLASS
} from './lipiMarkdown';
import { renderLekhaMarkdownToHtml } from '~/utils/markdown';
import type { script_list_type } from '~/state/lang_list';

/** Deterministic preview: bypass real transliteration. */
const identityTransliterate = (async (text: string) => text) as typeof transliterate;

const script: script_list_type = 'Devanagari';

describe('transliterateLipiSpansInMarkdown', () => {
  it('wraps single-line lipi in span', async () => {
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
    expect(out).not.toContain('<div class=');
  });

  it('wraps lipi with blank-line paragraphs in div', async () => {
    const inner = `line\n\n`;
    const out = await transliterateLipiSpansInMarkdown(`<lipi>${inner}a</lipi>`, script, identityTransliterate);
    expect(out).toContain(`<div class="${LIPI_SPAN_CLASS}">`);
    expect(out).toContain(inner);
    expect(out).toContain('a');
  });

  it('wraps lipi containing shloka in div', async () => {
    const md = `<lipi><shloka>line\n</shloka></lipi>`;
    const out = await transliterateLipiSpansInMarkdown(md, script, identityTransliterate);
    expect(out).toContain(`<div class="${LIPI_SPAN_CLASS}">`);
    expect(out).toContain('<shloka>');
    expect(out).not.toContain('<lipi>');
  });

  it('matches each lipi block independently (pairs do not swallow content between blocks)', async () => {
    const md = `# H\n\n<lipi>one</lipi>\n\n## Between\n\n<lipi>two</lipi>`;
    const out = await transliterateLipiSpansInMarkdown(md, script, identityTransliterate);
    const wrappers = [...out.matchAll(/<(span|div) class="site_lipi_text_md">/g)];
    expect(wrappers).toHaveLength(2);
    expect(out.indexOf('one')).toBeLessThan(out.indexOf('Between'));
    expect(out.indexOf('Between')).toBeLessThan(out.indexOf('two'));
  });
});

describe('stripLipiTagsFromHtml', () => {
  it('strips orphaned lipi tags from HTML', () => {
    expect(stripLipiTagsFromHtml('<p>x<lipi>y</lipi>z</p>')).toBe('<p>xyz</p>');
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
});
