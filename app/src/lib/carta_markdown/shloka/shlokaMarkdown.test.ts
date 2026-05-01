import { describe, expect, it } from 'vitest';
import { transliterate } from 'lipilekhika';
import { renderLekhaMarkdownToHtml } from '../markdown';
import type { script_list_type } from '~/state/lang_list';
import { expandShlokaSpansInMarkdown } from './shlokaMarkdown';

const identityTransliterate = (async (text: string) => text) as typeof transliterate;
const script: script_list_type = 'Devanagari';

describe('expandShlokaSpansInMarkdown', () => {
  it('does not treat literal <shloka> inside a markdown code fence as a real shloka block', () => {
    const md = ['```', '<shloka>', 'line', '</shloka>', '```'].join('\n');
    expect(expandShlokaSpansInMarkdown(md)).toBe(md);
  });

  it('documented limitation: an embedded ``` fence splits the top-level fence pass so <shloka>…</shloka> is not expanded', () => {
    const md = [
      '<shloka>',
      'intro verse line',
      '```',
      'some link https://example.com/path?q=1',
      '```',
      '</shloka>'
    ].join('\n');
    const out = expandShlokaSpansInMarkdown(md);
    expect(out).toContain('<shloka>');
    expect(out).toContain('</shloka>');
    expect(out).toContain('```');
    expect(out).toContain('example.com/path?q=1');
    expect(out).toContain('intro verse line');
    expect(out).not.toContain('<br/>');
  });

  it('still expands normal shloka without fences', () => {
    expect(expandShlokaSpansInMarkdown('<shloka>a\nb</shloka>')).toBe('a<br/>\nb');
  });

  it('expands shloka that sits outside fenced regions while leaving fenced bodies untouched', () => {
    const md = ['x', '', '```', 'y', '```', '', '<shloka>p\nq</shloka>', ''].join('\n');
    const out = expandShlokaSpansInMarkdown(md);
    expect(out).toContain('```');
    expect(out).toContain('p<br/>');
    expect(out).toContain('q');
    expect(out).not.toMatch(/<\s*shloka\b/i);
  });
});

describe('renderLekhaMarkdownToHtml + shloka snippets', () => {
  it('documented limitation: shloka containing embedded ``` does not strip shloka / parse inner markdown until expand handles inner fences', async () => {
    const md = ['<shloka>', '**bold**', '```', 'some link https://example.com', '```', '</shloka>'].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('**bold**');
    expect(html).not.toContain('<strong>bold</strong>');
    expect(html).toContain('```');
    expect(html).toContain('example.com');
  });

  it('renders markdown link inside shloka', async () => {
    const html = await renderLekhaMarkdownToHtml('<shloka>\n[label](https://example.test/foo)\n</shloka>', {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('href="https://example.test/foo"');
    expect(html).toContain('label');
  });

  it('renders inline code inside shloka', async () => {
    const html = await renderLekhaMarkdownToHtml('<shloka>\nuse `npm install`\n</shloka>', {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('<code>');
    expect(html).toContain('npm install');
  });

  it('renders bold plus fenced code when fenced block is outside shloka (verse line then code block)', async () => {
    const md = ['<shloka>', '**bold** verse line', '</shloka>', '', '```', 'some link https://example.org', '```', ''].join('\n');
    const html = await renderLekhaMarkdownToHtml(md, {
      script,
      lipiTransliterator: identityTransliterate,
      skipSourceSanitization: true
    });
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toMatch(/<pre[^>]*>/);
    expect(html).toContain('example.org');
  });
});
