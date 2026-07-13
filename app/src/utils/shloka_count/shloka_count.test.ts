import { describe, expect, it } from 'vitest';
import {
  count_shlokas,
  derive_shloka_nums,
  has_shloka_number_marker,
  is_shloka_text,
  mark_shloka_types
} from './index';

const NUMBERED_VERSE = `तपःस्वाध्यायनिरतं तपस्वी वाग्विदां वरम् ।
नारदं परिपप्रच्छ वाल्मीकिर्मुनिपुङ्गवम् ॥१-१-१॥`;

const MULTILINE_WITHOUT_NUMBER = `धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः ।
मामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय ॥`;

const SPEAKER_LINE = 'धृतराष्ट्र उवाच ।';
const HEADING_LINE = '॥ ॐ श्री परमात्मने नमः ॥';

describe('shloka_count', () => {
  describe('has_shloka_number_marker', () => {
    it('matches closed numbered markers', () => {
      expect(has_shloka_number_marker('॥१-१-६॥')).toBe(true);
      expect(has_shloka_number_marker('॥१॥')).toBe(true);
    });

    it('matches open numbered markers without closing ॥', () => {
      expect(has_shloka_number_marker('॥१')).toBe(true);
    });

    it('rejects plain purna virama without a number', () => {
      expect(has_shloka_number_marker('॥')).toBe(false);
    });
  });

  describe('is_shloka_text', () => {
    it('marks numbered two-line verses as shlokas', () => {
      expect(is_shloka_text(NUMBERED_VERSE)).toBe(true);
    });

    it('marks multiline text with ॥ but no number as a shloka', () => {
      expect(is_shloka_text(MULTILINE_WITHOUT_NUMBER)).toBe(true);
    });

    it('never marks a single non-empty line as a shloka', () => {
      expect(is_shloka_text(SPEAKER_LINE)).toBe(false);
      expect(is_shloka_text(HEADING_LINE)).toBe(false);
      expect(is_shloka_text('॥१॥')).toBe(false);
    });

    it('ignores blank lines when counting non-empty lines', () => {
      expect(is_shloka_text('line one\n\n\nline two ॥')).toBe(true);
      expect(is_shloka_text(`${SPEAKER_LINE}\n\n\n`)).toBe(false);
    });

    it('rejects multiline text without any ॥', () => {
      expect(is_shloka_text('line one\nline two')).toBe(false);
    });
  });

  describe('mark_shloka_types / derive_shloka_nums', () => {
    it('overwrites prior classifications and numbers shlokas sequentially', () => {
      const types = mark_shloka_types([
        HEADING_LINE,
        NUMBERED_VERSE,
        SPEAKER_LINE,
        MULTILINE_WITHOUT_NUMBER
      ]);
      expect(types).toEqual([false, true, false, true]);

      const rows = types.map((shloka_type) => ({ shloka_type }));
      expect(derive_shloka_nums(rows)).toEqual([null, 1, null, 2]);
      expect(count_shlokas(rows)).toBe(2);
    });
  });
});
