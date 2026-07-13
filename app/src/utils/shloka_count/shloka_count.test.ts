import { describe, expect, it } from 'vitest';
import {
  count_shlokas,
  derive_shloka_nums,
  has_shloka_number_marker,
  is_shloka_text,
  mark_shloka_types
} from './index';

/** Build text from Unicode code points (samples from Ramayana data). */
const from_codes = (...codes: number[]) => String.fromCharCode(...codes);

// From data/1. ramayanam/text_data/1/1.txt — verse ॥१-१-१॥
const RAMAYANA_1_1_1 = from_codes(
  2340, 2346, 2307, 2360, 2381, 2357, 2366, 2343, 2381, 2351, 2366, 2351, 2344, 2367,
  2352, 2340, 2306, 32, 2340, 2346, 2360, 2381, 2357, 2368, 32, 2357, 2366, 2327, 2381,
  2357, 2367, 2342, 2366, 2306, 32, 2357, 2352, 2350, 2381, 32, 2404, 10, 2344, 2366,
  2352, 2342, 2306, 32, 2346, 2352, 2367, 2346, 2346, 2381, 2352, 2330, 2381, 2331, 32,
  2357, 2366, 2354, 2381, 2350, 2368, 2325, 2367, 2352, 2381, 2350, 2369, 2344, 2367,
  2346, 2369, 2329, 2381, 2327, 2357, 2350, 2381, 32, 2405, 2407, 45, 2407, 45, 2407,
  2405
);

// From data/1. ramayanam/text_data/1/1.txt — verse ॥१-१-६॥
const RAMAYANA_1_1_6 = from_codes(
  2358, 2381, 2352, 2369, 2340, 2381, 2357, 2366, 32, 2330, 2376, 2340, 2340, 2381,
  2340, 2381, 2352, 2367, 2354, 2379, 2325, 2332, 2381, 2334, 2379, 32, 2357, 2366,
  2354, 2381, 2350, 2368, 2325, 2375, 2352, 2381, 2344, 2366, 2352, 2342, 2379, 32,
  2357, 2330, 2307, 32, 2404, 10, 2358, 2381, 2352, 2370, 2351, 2340, 2366, 2350, 2367,
  2340, 2367, 32, 2330, 2366, 2350, 2344, 2381, 2340, 2381, 2352, 2381, 2351, 32, 2346,
  2381, 2352, 2361, 2371, 2359, 2381, 2335, 2379, 32, 2357, 2366, 2325, 2381, 2351,
  2350, 2348, 2381, 2352, 2357, 2368, 2340, 2381, 32, 2405, 2407, 45, 2407, 45, 2412,
  2405
);

// From data/1. ramayanam/text_data/1/19.txt — verse ॥१-१९-१॥
const RAMAYANA_1_19_1 = from_codes(
  2340, 2330, 2381, 2331, 2381, 2352, 2369, 2340, 2381, 2357, 2366, 32, 2352, 2366,
  2332, 2360, 2367, 2306, 2361, 2360, 2381, 2351, 32, 2357, 2366, 2325, 2381, 2351,
  2350, 2342, 2381, 2349, 2369, 2340, 2357, 2367, 2360, 2381, 2340, 2352, 2350, 2381,
  32, 2404, 10, 2361, 2371, 2359, 2381, 2335, 2352, 2379, 2350, 2366, 32, 2350, 2361,
  2366, 2340, 2375, 2332, 2366, 32, 2357, 2367, 2358, 2381, 2357, 2366, 2350, 2367,
  2340, 2381, 2352, 2379, 2365, 2349, 2381, 2351, 2349, 2366, 2359, 2340, 32, 2405,
  2407, 45, 2407, 2415, 45, 2407, 2405
);

const SPEAKER_LINE = from_codes(
  2343, 2371, 2340, 2352, 2366, 2359, 2381, 2335, 2381, 2352, 32, 2313, 2357, 2366,
  2330, 32, 2404
);

const HEADING_LINE = from_codes(
  2405, 32, 2384, 32, 2358, 2381, 2352, 2368, 32, 2346, 2352, 2350, 2366, 2340, 2381,
  2350, 2344, 2375, 32, 2344, 2350, 2307, 32, 2405
);

const MULTILINE_WITHOUT_NUMBER = from_codes(
  2343, 2352, 2381, 2350, 2325, 2381, 2359, 2375, 2340, 2381, 2352, 2375, 32, 2325,
  2369, 2352, 2369, 2325, 2381, 2359, 2375, 2340, 2381, 2352, 2375, 32, 2360, 2350,
  2357, 2375, 2340, 2366, 32, 2351, 2369, 2351, 2369, 2340, 2381, 2360, 2357, 2307,
  32, 2404, 10, 2350, 2366, 2350, 2325, 2366, 2307, 32, 2346, 2366, 2339, 2381, 2337,
  2357, 2366, 2358, 2381, 2330, 2376, 2357, 32, 2325, 2367, 2350, 2325, 2369, 2352,
  2381, 2357, 2340, 32, 2360, 2334, 2381, 2332, 2351, 32, 2405
);

describe('shloka_count', () => {
  describe('has_shloka_number_marker', () => {
    it('matches closed numbered markers', () => {
      expect(has_shloka_number_marker(from_codes(2405, 2407, 45, 2407, 45, 2412, 2405))).toBe(
        true
      );
      expect(has_shloka_number_marker(from_codes(2405, 2407, 2405))).toBe(true);
    });

    it('matches open numbered markers without closing ॥', () => {
      expect(has_shloka_number_marker(from_codes(2405, 2407))).toBe(true);
    });

    it('rejects plain purna virama without a number', () => {
      expect(has_shloka_number_marker(from_codes(2405))).toBe(false);
    });
  });

  describe('is_shloka_text', () => {
    it('marks numbered two-line Ramayana verses as shlokas', () => {
      expect(is_shloka_text(RAMAYANA_1_1_1)).toBe(true);
      expect(is_shloka_text(RAMAYANA_1_1_6)).toBe(true);
      expect(is_shloka_text(RAMAYANA_1_19_1)).toBe(true);
    });

    it('marks multiline text with ॥ but no number as a shloka', () => {
      expect(is_shloka_text(MULTILINE_WITHOUT_NUMBER)).toBe(true);
    });

    it('never marks a single non-empty line as a shloka', () => {
      expect(is_shloka_text(SPEAKER_LINE)).toBe(false);
      expect(is_shloka_text(HEADING_LINE)).toBe(false);
      expect(is_shloka_text(from_codes(2405, 2407, 2405))).toBe(false);
      expect(is_shloka_text(from_codes(2405, 2407))).toBe(false);
    });

    it('ignores blank lines when counting non-empty lines', () => {
      const with_blank = `${RAMAYANA_1_1_1.split('\n')[0]}\n\n\n${RAMAYANA_1_1_1.split('\n')[1]}`;
      expect(is_shloka_text(with_blank)).toBe(true);
      expect(is_shloka_text(`${SPEAKER_LINE}\n\n\n`)).toBe(false);
    });

    it('rejects multiline text without any ॥', () => {
      expect(is_shloka_text('line one\nline two')).toBe(false);
      expect(is_shloka_text(`${SPEAKER_LINE}\n${SPEAKER_LINE}`)).toBe(false);
    });
  });

  describe('mark_shloka_types / derive_shloka_nums', () => {
    it('overwrites prior classifications and numbers shlokas sequentially', () => {
      const texts = [HEADING_LINE, RAMAYANA_1_1_1, SPEAKER_LINE, RAMAYANA_1_19_1];
      const types = mark_shloka_types(texts);
      expect(types).toEqual([false, true, false, true]);

      const nums = derive_shloka_nums(types.map((shloka_type) => ({ shloka_type })));
      expect(nums).toEqual([null, 1, null, 2]);
      expect(count_shlokas(types.map((shloka_type) => ({ shloka_type })))).toBe(2);
    });
  });
});
