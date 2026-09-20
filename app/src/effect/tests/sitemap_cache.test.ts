import { describe, expect, it } from 'vitest';
import type { recursive_list_type } from '~/state/data_types';
import {
  STATIC_SITEMAP_PATHS,
  SITEMAP_URL_LIMIT,
  buildSitemapIndexXml,
  buildStaticSitemapXml,
  buildUrlsetXml,
  chunkSitemapEntries,
  collect_project_sitemap_paths,
  escapeXml,
  joinSitemapUrl,
  parseSitemapNumber,
  PUBLIC_SITE_ORIGIN
} from '../sitemap_cache';

const nested_map = (): recursive_list_type => ({
  name_dev: 'रामायणम्',
  info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
  list: [
    {
      name_dev: 'बालकाण्डः',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: [
        {
          name_dev: 'प्रथमः',
          info: { type: 'shloka', shloka_count: 2, total: 8, shloka_count_expected: null },
          list: []
        },
        {
          name_dev: 'द्वितीयः',
          info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
          list: []
        }
      ]
    },
    {
      name_dev: 'empty kanda',
      info: { type: 'list', list_name: 'Sarga', list_count_expected: null },
      list: []
    }
  ]
});

describe('collect_project_sitemap_paths', () => {
  it('emits the project root for a shloka-only map', () => {
    const map: recursive_list_type = {
      name_dev: 'गीता',
      info: { type: 'shloka', shloka_count: 1, total: 4, shloka_count_expected: null },
      list: []
    };

    expect(collect_project_sitemap_paths('gita', map)).toEqual(['/gita']);
  });

  it('skips a childless list root', () => {
    const map: recursive_list_type = {
      name_dev: 'empty',
      info: { type: 'list', list_name: 'Kanda', list_count_expected: null },
      list: []
    };

    expect(collect_project_sitemap_paths('empty', map)).toEqual([]);
  });

  it('walks listed hierarchy into pretty URLs and skips empty list branches', () => {
    expect(collect_project_sitemap_paths('ramayanam', nested_map())).toEqual([
      '/ramayanam',
      '/ramayanam/kanda-1',
      '/ramayanam/kanda-1/sarga-1',
      '/ramayanam/kanda-1/sarga-2'
    ]);
  });
});

describe('sitemap xml helpers', () => {
  it('joins origin and path without duplicate slashes', () => {
    expect(joinSitemapUrl('https://thesanskritchannel.org/', '/lekha')).toBe(
      'https://thesanskritchannel.org/lekha'
    );
  });

  it('escapes XML special characters in loc', () => {
    expect(escapeXml(`https://x.test/a&b<"'>`)).toBe('https://x.test/a&amp;b&lt;&quot;&apos;&gt;');
  });

  it('builds urlset xml with optional lastmod', () => {
    const xml = buildUrlsetXml([
      { loc: 'https://thesanskritchannel.org/' },
      {
        loc: 'https://thesanskritchannel.org/lekha/hello',
        lastmod: new Date('2026-01-02T00:00:00.000Z')
      }
    ]);
    expect(xml).toContain('<loc>https://thesanskritchannel.org/</loc>');
    expect(xml).toContain(
      '<loc>https://thesanskritchannel.org/lekha/hello</loc><lastmod>2026-01-02T00:00:00.000Z</lastmod>'
    );
  });

  it('chunks entries at the sitemap URL limit', () => {
    const entries = Array.from({ length: SITEMAP_URL_LIMIT + 2 }, (_, i) => ({
      loc: `https://example.test/${i}`
    }));
    const chunks = chunkSitemapEntries(entries);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(SITEMAP_URL_LIMIT);
    expect(chunks[1]).toHaveLength(2);
    expect(chunkSitemapEntries([])).toEqual([]);
  });

  it('lists sitemap-0 plus one loc per dynamic chunk in the index', () => {
    const xml = buildSitemapIndexXml(2);
    expect(xml).toContain(`${PUBLIC_SITE_ORIGIN}/sitemap-0.xml`);
    expect(xml).toContain(`${PUBLIC_SITE_ORIGIN}/sitemap-1.xml`);
    expect(xml).toContain(`${PUBLIC_SITE_ORIGIN}/sitemap-2.xml`);
    expect(xml).not.toContain('sitemap-3.xml');
  });

  it('builds sitemap-0 from the public static routes', () => {
    const xml = buildStaticSitemapXml();
    expect(STATIC_SITEMAP_PATHS).toEqual(['/', '/texts', '/lekha', '/support']);
    for (const pathname of STATIC_SITEMAP_PATHS) {
      expect(xml).toContain(`<loc>${joinSitemapUrl(PUBLIC_SITE_ORIGIN, pathname)}</loc>`);
    }
  });
});

describe('parseSitemapNumber', () => {
  it('accepts canonical sitemap numbers including 0', () => {
    expect(parseSitemapNumber('0')).toBe(0);
    expect(parseSitemapNumber('1')).toBe(1);
    expect(parseSitemapNumber('12')).toBe(12);
  });

  it('rejects empty, padded, and non-numeric values', () => {
    expect(parseSitemapNumber('')).toBeNull();
    expect(parseSitemapNumber('01')).toBeNull();
    expect(parseSitemapNumber('index')).toBeNull();
    expect(parseSitemapNumber('-1')).toBeNull();
  });
});
