import { describe, expect, it } from 'vitest';
import { envBagFromUnknown, envString, parseOptionalBoolean, pickEnv } from '../env';

describe('pickEnv', () => {
  it('prefers the first non-empty map (public before private)', () => {
    const get = pickEnv(
      { PUBLIC_BETTER_AUTH_URL: 'https://public.example', VITE_SITE_URL: 'https://vite.example' },
      { PUBLIC_BETTER_AUTH_URL: 'https://private.example', OPENAI_API_KEY: 'sk-secret' }
    );
    expect(get('PUBLIC_BETTER_AUTH_URL')).toBe('https://public.example');
    expect(get('VITE_SITE_URL')).toBe('https://vite.example');
    expect(get('OPENAI_API_KEY')).toBe('sk-secret');
    expect(get('MISSING')).toBeUndefined();
  });

  it('skips empty strings', () => {
    const get = pickEnv({ QSTASH_URL: '' }, { QSTASH_URL: 'https://qstash.example' });
    expect(get('QSTASH_URL')).toBe('https://qstash.example');
  });
});

describe('envString / envBagFromUnknown / parseOptionalBoolean', () => {
  it('coerces import.meta-style values', () => {
    expect(envString('ok')).toBe('ok');
    expect(envString('')).toBeUndefined();
    expect(envString(true)).toBeUndefined();
    expect(envBagFromUnknown({ A: '1', B: '', C: false, D: 'x' })).toEqual({ A: '1', D: 'x' });
  });

  it('parses optional booleans', () => {
    expect(parseOptionalBoolean('true')).toBe(true);
    expect(parseOptionalBoolean('false')).toBe(false);
    expect(parseOptionalBoolean(undefined)).toBeUndefined();
    expect(parseOptionalBoolean('')).toBeUndefined();
  });
});
