import { describe, expect, it } from 'vitest'
import { createRedirectApp, siteLocation } from './redirect-app'

const MAIN = 'https://www.thesanskritchannel.org'

function req(pathWithQuery: string) {
  return new Request(`http://redirect.local${pathWithQuery}`)
}

describe('siteLocation', () => {
  it('joins base, path, and query', () => {
    expect(siteLocation(MAIN, '/ramayanam/kanda-1', '?foo=bar')).toBe(
      'https://www.thesanskritchannel.org/ramayanam/kanda-1?foo=bar'
    )
  })

  it('returns null when base is missing', () => {
    expect(siteLocation(undefined, '/', '')).toBeNull()
  })
})

describe('createRedirectApp', () => {
  const app = createRedirectApp(MAIN)

  it('redirects / to main site origin with trailing slash', async () => {
    const res = await app.fetch(req('/'))
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe(`${MAIN}/`)
  })

  it('redirects numeric path to canonical pretty URL', async () => {
    const res = await app.fetch(req('/ramayanam/1'))
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe(`${MAIN}/ramayanam/kanda-1`)
  })

  it('redirects nested numeric path to full canonical path', async () => {
    const res = await app.fetch(req('/ramayanam/1/1'))
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe(`${MAIN}/ramayanam/kanda-1/sarga-1`)
  })

  it('keeps pretty paths on canonical URLs', async () => {
    const res = await app.fetch(req('/ramayanam/kanda-1/sarga-1'))
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe(`${MAIN}/ramayanam/kanda-1/sarga-1`)
  })

  it('falls back to same pathname for unknown routes', async () => {
    const res = await app.fetch(req('/not-a-project/foo'))
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe(`${MAIN}/not-a-project/foo`)
  })

  it('preserves query string on redirect', async () => {
    const res = await app.fetch(req('/ramayanam/1?foo=bar'))
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe(`${MAIN}/ramayanam/kanda-1?foo=bar`)
  })

  it('returns 500 when MAIN_SITE_URL is unset', async () => {
    const bare = createRedirectApp(undefined)
    const res = await bare.fetch(req('/'))
    expect(res.status).toBe(500)
  })
})
