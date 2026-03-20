import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANG_ID,
  DEFAULT_SCRIPT_ID,
  parse_lang_id_cookie,
  parse_script_id_cookie
} from './cookies';

describe('cookies', () => {
  it('defaults missing language cookie to -1', () => {
    expect(parse_lang_id_cookie(undefined)).toBe(DEFAULT_LANG_ID);
    expect(parse_lang_id_cookie(null)).toBe(DEFAULT_LANG_ID);
  });

  it('falls back to -1 for invalid values', () => {
    expect(parse_lang_id_cookie('abc')).toBe(DEFAULT_LANG_ID);
    expect(parse_lang_id_cookie('1.5')).toBe(DEFAULT_LANG_ID);
  });

  it('parses integer language IDs including the disabled default', () => {
    expect(parse_lang_id_cookie('-1')).toBe(-1);
    expect(parse_lang_id_cookie('3')).toBe(3);
  });

  it('defaults missing script cookie to the default script id', () => {
    expect(parse_script_id_cookie(undefined)).toBe(DEFAULT_SCRIPT_ID);
    expect(parse_script_id_cookie(null)).toBe(DEFAULT_SCRIPT_ID);
  });

  it('falls back to the default script id for invalid script values', () => {
    expect(parse_script_id_cookie('abc')).toBe(DEFAULT_SCRIPT_ID);
    expect(parse_script_id_cookie('1.5')).toBe(DEFAULT_SCRIPT_ID);
  });

  it('parses integer script IDs', () => {
    expect(parse_script_id_cookie('1')).toBe(1);
    expect(parse_script_id_cookie('12')).toBe(12);
  });
});
