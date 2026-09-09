import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getStoredSession, setStoredSession } from './credentials.js'
import { CliSession } from './session.js'

let dir = ''

function token(expiresAtSec: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAtSec })).toString('base64url')
  return `header.${payload}.signature`
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hodman-session-test-'))
  process.env.HODMAN_CONFIG_DIR = dir
  process.env.HODMAN_CREDENTIAL_BACKEND = 'file'
  process.env.HODMAN_HOST = 'https://example.test'
})

afterEach(async () => {
  vi.unstubAllGlobals()
  delete process.env.HODMAN_CONFIG_DIR
  delete process.env.HODMAN_CREDENTIAL_BACKEND
  delete process.env.HODMAN_HOST
  delete process.env.HODMAN_REFRESH_TOKEN
  await fs.rm(dir, { recursive: true, force: true })
})

describe('CliSession', () => {
  it('persists the rotated refresh token', async () => {
    await setStoredSession('https://example.test', {
      refreshToken: 'refresh-0',
      accessToken: token(Math.floor(Date.now() / 1000) - 60),
      accessTokenExpiresAt: Date.now() - 60_000,
      userLabel: 'user@example.test',
    })

    const nextAccessToken = token(Math.floor(Date.now() / 1000) + 3600)
    vi.stubGlobal('fetch', vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['X-Refresh-Token-Rotation']).toBe('1')
      return new Response(JSON.stringify({
        accessToken: nextAccessToken,
        refreshToken: 'refresh-1',
      }), { status: 200 })
    }))

    const session = new CliSession()
    await expect(session.accessToken()).resolves.toBe(nextAccessToken)
    await expect(getStoredSession('https://example.test')).resolves.toMatchObject({
      refreshToken: 'refresh-1',
      accessToken: nextAccessToken,
    })
  })

  it('does not rotate or persist a refresh token supplied through ENV', async () => {
    process.env.HODMAN_REFRESH_TOKEN = 'refresh-from-environment'
    const nextAccessToken = token(Math.floor(Date.now() / 1000) + 3600)
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['X-Refresh-Token-Rotation']).toBeUndefined()
      return new Response(JSON.stringify({
        accessToken: nextAccessToken,
        refreshToken: 'unexpected-successor',
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(new CliSession().accessToken()).resolves.toBe(nextAccessToken)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(fs.access(path.join(dir, 'credentials.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('serializes refresh across concurrent CLI sessions and reuses the persisted result', async () => {
    await setStoredSession('https://example.test', {
      refreshToken: 'refresh-0',
      accessToken: token(Math.floor(Date.now() / 1000) - 60),
      accessTokenExpiresAt: Date.now() - 60_000,
      userLabel: 'user@example.test',
    })

    const nextAccessToken = token(Math.floor(Date.now() / 1000) + 3600)
    const fetchMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return new Response(JSON.stringify({
        accessToken: nextAccessToken,
        refreshToken: 'refresh-1',
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([
      new CliSession().accessToken(),
      new CliSession().accessToken(),
    ])

    expect(first).toBe(nextAccessToken)
    expect(second).toBe(nextAccessToken)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(getStoredSession('https://example.test')).resolves.toMatchObject({
      refreshToken: 'refresh-1',
      accessToken: nextAccessToken,
    })
  })
})
