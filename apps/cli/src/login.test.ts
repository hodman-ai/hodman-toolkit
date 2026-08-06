import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseArgs } from './args.js'
import { readConfig } from './config.js'
import { getStoredSession } from './credentials.js'

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
})

afterEach(async () => {
  vi.unstubAllGlobals()
  if (previousHost === undefined) delete process.env.HODMAN_HOST
  else process.env.HODMAN_HOST = previousHost
  delete process.env.HODMAN_CONFIG_DIR
  delete process.env.HODMAN_CREDENTIAL_BACKEND
  delete process.env.HODMAN_PASSWORD
  delete process.env.HODMAN_CLI_NO_AUTO_RUN
  await fs.rm(dir, { recursive: true, force: true })
})

describe('login command', () => {
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
      return new Response(JSON.stringify({ err: 'not_found' }), { status: 404 })
    }))

    const { runCommand } = await import('./index.js')
    await expect(runCommand(parseArgs(['auth', 'login', '--host', 'https://example.test', '--email', 'user@example.com'])))
      .resolves.toMatchObject({ ok: true, tenant: 'acme' })
    await expect(readConfig()).resolves.toMatchObject({ host: 'https://example.test', tenant: 'acme' })
    await expect(getStoredSession('https://example.test')).resolves.toMatchObject({ refreshToken: 'refresh-token' })
  })
})
