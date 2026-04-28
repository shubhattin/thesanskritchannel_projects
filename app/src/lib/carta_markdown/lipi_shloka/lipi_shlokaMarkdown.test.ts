import { describe, expect, it } from 'vitest';
import { formatMarkdownSource, sanitizeAndFormatLekhaMarkdownForStorage } from '../markdown';
import {
  expandLipiShlokaCompoundTags,
  isolateLipiShlokaBlocksForRemarkFormat,
  restoreLipiShlokaBlocksAfterRemarkFormat
} from './lipiShlokaMarkdown';

describe('expandLipiShlokaCompoundTags', () => {
  it('replaces open and close tags', () => {
    const md = `<lipi-shloka>अ\nब</lipi-shloka>`;
    expect(expandLipiShlokaCompoundTags(md)).toBe(`<lipi>\n<shloka>अ\nब</shloka>\n</lipi>`);
  });

  it('handles attributes on opening tag', () => {
    expect(expandLipiShlokaCompoundTags(`<lipi-shloka data-x="1">x</lipi-shloka>`)).toBe(
      `<lipi>\n<shloka>x</shloka>\n</lipi>`
    );
  });

  it('handles two adjacent blocks independently', () => {
    const out = expandLipiShlokaCompoundTags(
      `<lipi-shloka>a</lipi-shloka>\n\n<LiPi-ShLoKa>b</LiPi-ShLoKa>`
    );
    expect(out.match(/<lipi>\n<shloka>/g)?.length).toBe(2);
    expect(out.endsWith('</lipi>')).toBe(true);
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
