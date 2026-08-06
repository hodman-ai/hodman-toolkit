import { afterEach, describe, expect, it, vi } from 'vitest'

import { HodmanApiClient, HodmanApiError } from './index.js'

afterEach(() => vi.unstubAllGlobals())

describe('HodmanApiClient', () => {
  it('adds auth and query context', async () => {
    const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toBe('https://hodman.ai/api/projects?tenant=acme&limit=10&offset=0')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token')
      return new Response(JSON.stringify({ result: [], total: 0, limit: 10, offset: 0 }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new HodmanApiClient('https://hodman.ai/', async () => 'token')
    await expect(client.projects('acme', 10, 0)).resolves.toMatchObject({ total: 0 })
  })

  it('returns structured API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ err: 'forbidden', errDescription: 'No access' }), { status: 403 })))
    const client = new HodmanApiClient('https://hodman.ai', async () => 'token')
    await expect(client.profile()).rejects.toMatchObject<HodmanApiError>({ code: 'forbidden', status: 403 })
  })
})
