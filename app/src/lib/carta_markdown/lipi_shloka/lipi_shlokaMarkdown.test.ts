import { describe, expect, it } from 'vitest';
import { transliterate } from 'lipilekhika';
import {
  formatMarkdownSource,
  renderLekhaMarkdownToHtml,
  sanitizeAndFormatLekhaMarkdownForStorage
} from '../markdown';
import type { script_list_type } from '~/state/lang_list';
import {
  expandLipiShlokaCompoundTags,
  isolateLipiShlokaBlocksForRemarkFormat,
  restoreLipiShlokaBlocksAfterRemarkFormat
} from './lipiShlokaMarkdown';

const identityTransliterate = (async (text: string) => text) as typeof transliterate;
const script: script_list_type = 'Devanagari';

describe('expandLipiShlokaCompoundTags', () => {
  it('replaces open and close tags', () => {
    const md = `<lipi-shloka>अ\nब</lipi-shloka>`;
    expect(expandLipiShlokaCompoundTags(md)).toBe(`<shloka>\n<lipi>अ\nब</lipi>\n</shloka>`);
  });

  it('handles attributes on opening tag', () => {
    expect(expandLipiShlokaCompoundTags(`<lipi-shloka data-x="1">x</lipi-shloka>`)).toBe(
      `<shloka>\n<lipi>x</lipi>\n</shloka>`
    );
  });

  it('handles two adjacent blocks independently', () => {
    const out = expandLipiShlokaCompoundTags(
      `<lipi-shloka>a</lipi-shloka>\n\n<LiPi-ShLoKa>b</LiPi-ShLoKa>`
    );
    expect(out.match(/<shloka>\n<lipi>/g)?.length).toBe(2);
    expect(out.endsWith('</shloka>')).toBe(true);
  });
});

describe('isolateLipiShlokaBlocksForRemarkFormat / restore', () => {
  it('round-trips one block with blank lines between verses', () => {
    const original = `<lipi-shloka>स्तanza१ line

स्तanza२ line


स्तanza३ line</lipi-shloka>`;
    const { text, blocks } = isolateLipiShlokaBlocksForRemarkFormat(original);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe(original);
    expect(text).toContain('<!--lekha-fmt-lipi-shloka:0-->');
    expect(text).not.toContain('<lipi-shloka>');
    expect(restoreLipiShlokaBlocksAfterRemarkFormat(text, blocks)).toBe(original);
  });

  it('isolates multiple blocks with stable ids', () => {
    const a = `<lipi-shloka>a</lipi-shloka>`;
    const b = `<lipi-shloka>b\n\nb</lipi-shloka>`;
    const md = `# x\n\n${a}\n\n${b}`;
    const { text, blocks } = isolateLipiShlokaBlocksForRemarkFormat(md);
    expect(blocks).toEqual([a, b]);
    expect(text).toContain('<!--lekha-fmt-lipi-shloka:0-->');
    expect(text).toContain('<!--lekha-fmt-lipi-shloka:1-->');
    expect(restoreLipiShlokaBlocksAfterRemarkFormat(text, blocks)).toBe(md);
  });

  it('allows spaces inside HTML comment sentinel on restore', () => {
    const blocks = [`<lipi-shloka>x</lipi-shloka>`];
    expect(
      restoreLipiShlokaBlocksAfterRemarkFormat('<!--  lekha-fmt-lipi-shloka:0  -->', blocks)
    ).toBe(blocks[0]);
  });
});

describe('formatMarkdownSource + lipi-shloka', () => {
  it('keeps closing tag contiguous with inner content (multi-blank-line regression)', async () => {
    const md = `# Section

<lipi-shloka>
पहला

दूसरा


तीसरा श्लोक
</lipi-shloka>

## Next
`;

    const out = await formatMarkdownSource(md);
    expect(out).toContain('<lipi-shloka>');
    expect(out).toContain('</lipi-shloka>');
    const idxOpen = out.indexOf('<lipi-shloka>');
    const idxClose = out.indexOf('</lipi-shloka>');
    expect(idxOpen).toBeGreaterThanOrEqual(0);
    expect(idxClose).toBeGreaterThan(idxOpen);
    const inner = out.slice(idxOpen, idxClose + '</lipi-shloka>'.length);
    expect(inner).toContain('पहला');
    expect(inner).toContain('दूसरा');
    expect(inner).toContain('तीसरा श्लोक');
    expect(inner.match(/<\/lipi-shloka>/g)?.length).toBe(1);
  });

  it('single-par lipi-shloka still formats safely', async () => {
    const md = `<lipi-shloka>एक लाइन॥</lipi-shloka>`;
    const out = await formatMarkdownSource(md);
    expect(out.trim()).toContain('<lipi-shloka>');
    expect(out.trim()).toContain('</lipi-shloka>');
    expect(out).toContain('एक लाइन॥');
  });

  it('sanitizeAndFormatLekhaMarkdownForStorage keeps paired tags when inner blank lines exist', async () => {
    const md = `# Heading\n\n<lipi-shloka>S1\n\nS2</lipi-shloka>\n`;
    const out = await sanitizeAndFormatLekhaMarkdownForStorage(md);
    expect(out).toContain('<lipi-shloka>');
    expect(out).toContain('S1');
    expect(out).toContain('S2');
    expect(out.match(/<\s*\/\s*lipi-shloka\s*>/gi)?.length).toBe(1);
  });
});

describe('renderLekhaMarkdownToHtml + lipi-shloka formatting', () => {
  it('parses markdown emphasis inside lipi-shloka', async () => {
    const html = await renderLekhaMarkdownToHtml(
      `<lipi-shloka>\n**bold** _italic_\n</lipi-shloka>`,
      {
        script,
        lipiTransliterator: identityTransliterate,
        skipSourceSanitization: true
      }
    );
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('parses markdown links inside lipi-shloka', async () => {
    const md = ['<lipi-shloka>', '[some link](https://example.com/path?q=1)', '</lipi-shloka>'].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('href="https://example.com/path?q=1"');
    expect(html).toContain('some link');
    expect(html).toContain('site_lipi_text_md');
  });

  it('parses inline code inside lipi-shloka', async () => {
    const html = await renderLekhaMarkdownToHtml('<lipi-shloka>\nuse `snippet()` here\n</lipi-shloka>', {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('<code>');
    expect(html).toContain('snippet()');
    expect(html).toContain('site_lipi_text_md');
  });

  it('parses emphasis, link, and inline code together inside lipi-shloka', async () => {
    const md = [
      '<lipi-shloka>',
      '**bold** and _italic_ then [ref](https://a.test) and `code`',
      '</lipi-shloka>'
    ].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('href="https://a.test"');
    expect(html).toContain('<code>code</code>');
  });

  it('does not swallow a following heading after lipi-shloka', async () => {
    const md = ['<lipi-shloka>', 'verse **line**', '</lipi-shloka>', '', '## After block', ''].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html.match(/<h2\b/g)?.length ?? 0).toBe(1);
    expect(html).toContain('After block');
    expect(html).toContain('<strong>line</strong>');
  });

  it('keeps Devanagari verse plus markdown emphasis inside lipi-shloka', async () => {
    const md = '<lipi-shloka>\nअन्तः **मुखः** _भावः_\n</lipi-shloka>';
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('अन्तः');
    expect(html).toContain('<strong>मुखः</strong>');
    expect(html).toContain('<em>भावः</em>');
  });

  it('documented limitation: embedded ``` inside lipi-shloka leaves markdown literals inside the lipi wrapper (shloka not expanded when split by fences)', async () => {
    const md = ['<lipi-shloka>', '**note**', '```', 'some link https://example.com', '```', '</lipi-shloka>'].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('site_lipi_text_md');
    expect(html).toContain('```');
    expect(html).toContain('example.com');
    expect(html).toContain('**note**');
    expect(html).not.toContain('<strong>note</strong>');
  });
});

describe('formatMarkdownSource + lipi-shloka (embedded snippets)', () => {
  it('round-trips lipi-shloka containing a fenced code block', async () => {
    const md = [
      '# T',
      '',
      '<lipi-shloka>',
      'intro line',
      '',
      '```',
      'some link https://example.com',
      '```',
      '</lipi-shloka>',
      '',
      '## Next',
      ''
    ].join('\n');
    const out = await formatMarkdownSource(md);
    expect(out).toContain('<lipi-shloka>');
    expect(out).toContain('</lipi-shloka>');
    expect(out).toContain('```');
    expect(out).toContain('example.com');
    expect(out).toContain('## Next');
    const { text, blocks } = isolateLipiShlokaBlocksForRemarkFormat(md);
    expect(restoreLipiShlokaBlocksAfterRemarkFormat(text, blocks)).toBe(md);
  });

  it('sanitizeAndFormat keeps lipi-shloka with inline-looking markdown intact', async () => {
    const md = '# x\n\n<lipi-shloka>**b** [l](https://z.test)\n</lipi-shloka>\n';
    const out = await sanitizeAndFormatLekhaMarkdownForStorage(md);
    expect(out).toContain('<lipi-shloka>');
    expect(out).toContain('**b**');
    expect(out).toContain('https://z.test');
  });
});
