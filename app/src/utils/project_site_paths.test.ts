import { describe, expect, it } from 'vitest';
import {
  decide_text_route_redirect,
  split_project_key_uid
} from './project_site_paths';

const match =
  (entries: Record<string, string>) => (key: string, uid: string) =>
    entries[key] === uid;

describe('split_project_key_uid', () => {
  it('returns null for keys without a dash', () => {
    expect(split_project_key_uid('gita', match({ gita: 'Ab12C' }))).toBeNull();
  });

  it('returns null when the suffix is not exactly 5 chars', () => {
    const is_match = match({ gita: 'Ab12C' });
    expect(split_project_key_uid('gita-Ab12', is_match)).toBeNull();
    expect(split_project_key_uid('gita-Ab12CD', is_match)).toBeNull();
  });

  it('returns null when the suffix has non-uid characters', () => {
    expect(split_project_key_uid('gita-Ab!2C', match({ gita: 'Ab!2C' }))).toBeNull();
    expect(split_project_key_uid('gita-Ab 2C', match({ gita: 'Ab 2C' }))).toBeNull();
  });

  it('returns null for an empty key prefix', () => {
    expect(split_project_key_uid('-Ab12C', match({ '': 'Ab12C' }))).toBeNull();
  });

  it('splits a matching key and uid', () => {
    expect(split_project_key_uid('gita-Ab12C', match({ gita: 'Ab12C' }))).toEqual({
      key: 'gita',
      uid: 'Ab12C'
    });
  });

  it('returns null when the uid does not match the key', () => {
    expect(split_project_key_uid('gita-Xy98Z', match({ gita: 'Ab12C' }))).toBeNull();
  });

  it('returns null when the key does not exist', () => {
    expect(split_project_key_uid('unknown-Ab12C', match({ gita: 'Ab12C' }))).toBeNull();
  });

  it('handles multi-dash project keys', () => {
    expect(
      split_project_key_uid('srimad-bhagavatam-Xy12_', match({ 'srimad-bhagavatam': 'Xy12_' }))
    ).toEqual({ key: 'srimad-bhagavatam', uid: 'Xy12_' });
  });

  it('handles uids that themselves contain a dash', () => {
    expect(split_project_key_uid('gita-ab-cd', match({ gita: 'ab-cd' }))).toEqual({
      key: 'gita',
      uid: 'ab-cd'
    });
  });
});

describe('decide_text_route_redirect', () => {
  const canonical_path = '/gita/kanda-1';

  it('serves direct canonical routes as-is', () => {
    expect(
      decide_text_route_redirect({
        was_redirect: false,
        preview_via_uid: false,
        listed: true,
        numeric_route: false,
        canonical_path
      })
    ).toBeNull();
  });

  it('redirects old redirect-rule keys to canonical', () => {
    expect(
      decide_text_route_redirect({
        was_redirect: true,
        preview_via_uid: false,
        listed: true,
        numeric_route: false,
        canonical_path
      })
    ).toBe(canonical_path);
  });

  it('always canonicalizes numeric routes', () => {
    expect(
      decide_text_route_redirect({
        was_redirect: false,
        preview_via_uid: false,
        listed: true,
        numeric_route: true,
        canonical_path
      })
    ).toBe(canonical_path);
  });

  it('redirects uid-form urls of listed projects to canonical', () => {
    expect(
      decide_text_route_redirect({
        was_redirect: false,
        preview_via_uid: true,
        listed: true,
        numeric_route: false,
        canonical_path
      })
    ).toBe(canonical_path);
  });

  it('serves uid-form urls of unlisted projects as-is (share urls)', () => {
    expect(
      decide_text_route_redirect({
        was_redirect: false,
        preview_via_uid: true,
        listed: false,
        numeric_route: false,
        canonical_path
      })
    ).toBeNull();
  });

  it('does not bounce numeric uid-form share urls to a 404 canonical', () => {
    expect(
      decide_text_route_redirect({
        was_redirect: false,
        preview_via_uid: true,
        listed: false,
        numeric_route: true,
        canonical_path
      })
    ).toBeNull();
  });

  it('redirects numeric uid-form urls of listed projects', () => {
    expect(
      decide_text_route_redirect({
        was_redirect: false,
        preview_via_uid: true,
        listed: true,
        numeric_route: true,
        canonical_path
      })
    ).toBe(canonical_path);
  });
});
