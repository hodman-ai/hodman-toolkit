import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseArgs } from './args.js'
import { readConfig } from './config.js'
import { getStoredSession, setStoredSession } from './credentials.js'
import { CliSession } from './session.js'

let dir = ''
let previousHost: string | undefined

function token(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `header.${payload}.signature`
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hodman-login-test-'))
  previousHost = process.env.HODMAN_HOST
  delete process.env.HODMAN_HOST
  process.env.HODMAN_CONFIG_DIR = dir
  process.env.HODMAN_CREDENTIAL_BACKEND = 'file'
  process.env.HODMAN_PASSWORD = 'test-password'
  process.env.HODMAN_CLI_NO_AUTO_RUN = '1'
  delete process.env.HODMAN_REFRESH_TOKEN
})

afterEach(async () => {
  vi.unstubAllGlobals()
  if (previousHost === undefined) delete process.env.HODMAN_HOST
  else process.env.HODMAN_HOST = previousHost
  delete process.env.HODMAN_CONFIG_DIR
  delete process.env.HODMAN_CREDENTIAL_BACKEND
  delete process.env.HODMAN_PASSWORD
  delete process.env.HODMAN_CLI_NO_AUTO_RUN
  delete process.env.HODMAN_REFRESH_TOKEN
  await fs.rm(dir, { recursive: true, force: true })
})

describe('login command', () => {
  it('rejects interactive login while an ENV credential owns authentication', async () => {
    process.env.HODMAN_REFRESH_TOKEN = 'environment-refresh'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { runCommand } = await import('./index.js')

    await expect(runCommand(parseArgs(['auth', 'login', '--host', 'https://example.test', '--email', 'user@example.com'])))
      .rejects.toThrow('environment_credential_active')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs out an ENV credential without deleting a persisted session', async () => {
    await setStoredSession('https://example.test', {
      refreshToken: 'persisted-refresh', accessToken: null, accessTokenExpiresAt: null, userLabel: 'persisted-user',
    })
    process.env.HODMAN_HOST = 'https://example.test'
    process.env.HODMAN_REFRESH_TOKEN = 'environment-refresh'
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'environment-refresh' })
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { runCommand } = await import('./index.js')

    await expect(runCommand(parseArgs(['auth', 'logout']))).resolves.toMatchObject({ ok: true })
    delete process.env.HODMAN_REFRESH_TOKEN
    await expect(getStoredSession('https://example.test')).resolves.toMatchObject({ refreshToken: 'persisted-refresh' })
  })

  it('serializes persisted logout with refresh so a session cannot be resurrected', async () => {
    process.env.HODMAN_HOST = 'https://example.test'
    await setStoredSession('https://example.test', {
      refreshToken: 'refresh-0', accessToken: null, accessTokenExpiresAt: null, userLabel: 'persisted-user',
    })
    let markRefreshStarted: (() => void) | undefined
    let releaseRefresh: (() => void) | undefined
    const refreshStarted = new Promise<void>((resolve) => { markRefreshStarted = resolve })
    const refreshMayFinish = new Promise<void>((resolve) => { releaseRefresh = resolve })
    const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const pathname = new URL(String(url)).pathname
      if (pathname === '/auth/core/token') {
        markRefreshStarted?.()
        await refreshMayFinish
        return new Response(JSON.stringify({ accessToken: token(), refreshToken: 'refresh-1' }), { status: 200 })
      }
      if (pathname === '/auth/core/logout') {
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'refresh-1' })
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }
      return new Response(JSON.stringify({ err: 'not_found' }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { runCommand } = await import('./index.js')

    const refreshing = new CliSession().accessToken()
    await refreshStarted
    const loggingOut = runCommand(parseArgs(['auth', 'logout']))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    releaseRefresh?.()

    await expect(refreshing).resolves.toBeTypeOf('string')
    await expect(loggingOut).resolves.toMatchObject({ ok: true })
    await expect(getStoredSession('https://example.test')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stores the refresh token and selects the current tenant', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: URL | RequestInfo) => {
      const pathname = new URL(String(url)).pathname
      if (pathname === '/auth/core/login') {
        return new Response(JSON.stringify({ accessToken: token(), refreshToken: 'refresh-token' }), { status: 200 })
      }
      if (pathname === '/auth/core/profile') {
        return new Response(JSON.stringify({
          user: { uuid: 'user-1', name: 'User', email: 'user@example.com' },
          tenants: [{
            uuid: 'tenant-1', name: 'acme', displayName: 'Acme', tenantType: 'customer-tenant',
            status: 'working', scopes: ['edit'], roles: [], owner: true, current: true,
          }],
        }), { status: 200 })
      }
      if (pathname === '/api/projects/parent-1') {
        return new Response(JSON.stringify({ uuid: 'parent-1', tenant: 'acme', title: 'Parent' }), { status: 200 })
      }
      if (pathname === '/api/projects/parent-1/subprojects/provision') {
        return new Response(JSON.stringify({
          project: { uuid: 'child-1', tenant: 'acme', title: 'Docs', projectKind: 'sub-project' },
          threadId: 'thread-1',
        }), { status: 200 })
      }
      if (pathname === '/api/releases') {
        return new Response(JSON.stringify({ result: [{ uuid: 'release-1' }], total: 1, limit: 20, offset: 0 }), { status: 200 })
      }
      if (pathname === '/api/releases/release-1') {
        return new Response(JSON.stringify({ uuid: 'release-1', projectId: 'child-1' }), { status: 200 })
      }
      return new Response(JSON.stringify({ err: 'not_found' }), { status: 404 })
    }))

    const { runCommand } = await import('./index.js')
    await expect(runCommand(parseArgs(['auth', 'login', '--host', 'https://example.test', '--email', 'user@example.com'])))
      .resolves.toMatchObject({ ok: true, tenant: 'acme' })
    await expect(readConfig()).resolves.toMatchObject({ host: 'https://example.test', tenant: 'acme' })
    await expect(getStoredSession('https://example.test')).resolves.toMatchObject({ refreshToken: 'refresh-token' })

    await expect(runCommand(parseArgs(['project', 'use', 'parent-1']))).resolves.toMatchObject({ ok: true })
    await expect(runCommand(parseArgs([
      'project', 'create-subproject', '--pathname', '/docs', '--type', 'web-app', '--prompt', 'Build docs',
    ]))).resolves.toMatchObject({ project: { uuid: 'child-1', projectKind: 'sub-project' } })
    await expect(runCommand(parseArgs(['project', 'releases', '--limit', '20']))).resolves.toMatchObject({ total: 1 })
    await expect(runCommand(parseArgs(['project', 'release', '--release', 'release-1']))).resolves.toMatchObject({ uuid: 'release-1' })
  })
})
