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

  it('paginates and searches tenants', async () => {
    const fetchMock = vi.fn(async (url: URL | RequestInfo) => {
      expect(String(url)).toBe('https://hodman.ai/auth/tenants?limit=20&offset=40&search=demo')
      return new Response(JSON.stringify({ result: [], total: 0, limit: 20, offset: 40 }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new HodmanApiClient('https://hodman.ai', async () => 'token')
    await expect(client.tenants(20, 40, 'demo')).resolves.toMatchObject({ total: 0, offset: 40 })
  })

  it('calls the existing Release history endpoints', async () => {
    const fetchMock = vi.fn(async (url: URL | RequestInfo) => {
      const value = String(url)
      if (value.includes('/api/releases/release-1')) {
        expect(value).toBe('https://hodman.ai/api/releases/release-1?tenant=acme')
        return new Response(JSON.stringify({ uuid: 'release-1', projectId: 'project-1' }), { status: 200 })
      }
      expect(value).toBe('https://hodman.ai/api/releases?tenant=acme&projectId=project-1&limit=20&offset=40&sortby=id&sortdir=desc')
      return new Response(JSON.stringify({ result: [], total: 0, limit: 20, offset: 40 }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new HodmanApiClient('https://hodman.ai', async () => 'token')
    await expect(client.releases('acme', 'project-1', 20, 40)).resolves.toMatchObject({ total: 0 })
    await expect(client.release('acme', 'release-1')).resolves.toMatchObject({ uuid: 'release-1' })
  })

  it('provisions a sub-project through the parent endpoint', async () => {
    const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toBe('https://hodman.ai/api/projects/parent%2F1/subprojects/provision?tenant=acme')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ pathname: '/docs', projectType: 'web-app', prompt: 'Build docs' })
      return new Response(JSON.stringify({ project: { uuid: 'child-1' }, threadId: 'thread-1' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new HodmanApiClient('https://hodman.ai', async () => 'token')
    await expect(client.provisionSubProject('acme', 'parent/1', {
      pathname: '/docs', projectType: 'web-app', prompt: 'Build docs',
    })).resolves.toMatchObject({ project: { uuid: 'child-1' } })
  })

  it('opts into refresh-token rotation', async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['X-Refresh-Token-Rotation']).toBe('1')
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'refresh-0' })
      return new Response(JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new HodmanApiClient('https://hodman.ai')
    await expect(client.refresh('refresh-0')).resolves.toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' })
  })

  it('can refresh without rotation for non-persistable credentials', async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['X-Refresh-Token-Rotation']).toBeUndefined()
      return new Response(JSON.stringify({ accessToken: 'access-1' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new HodmanApiClient('https://hodman.ai')
    await expect(client.refresh('refresh-from-env', false)).resolves.toEqual({ accessToken: 'access-1' })
  })

  it('returns structured API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ err: 'forbidden', errDescription: 'No access' }), { status: 403 })))
    const client = new HodmanApiClient('https://hodman.ai', async () => 'token')
    await expect(client.profile()).rejects.toMatchObject<HodmanApiError>({ code: 'forbidden', status: 403 })
  })
})
