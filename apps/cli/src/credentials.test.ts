import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { deleteStoredSession, getStoredSession, setStoredSession } from './credentials.js'

let dir = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hodman-cli-test-'))
  process.env.HODMAN_CONFIG_DIR = dir
  process.env.HODMAN_CREDENTIAL_BACKEND = 'file'
})

afterEach(async () => {
  delete process.env.HODMAN_CONFIG_DIR
  delete process.env.HODMAN_CREDENTIAL_BACKEND
  await fs.rm(dir, { recursive: true, force: true })
})

describe('credential storage', () => {
  it('stores sessions per host in a permission-restricted fallback file', async () => {
    await setStoredSession('https://hodman.ai', {
      refreshToken: 'refresh', accessToken: 'access', accessTokenExpiresAt: 123, userLabel: 'user@example.com',
    })
    expect(await getStoredSession('https://hodman.ai')).toMatchObject({ refreshToken: 'refresh' })
    const stat = await fs.stat(path.join(dir, 'credentials.json'))
    expect(stat.mode & 0o777).toBe(0o600)
    await deleteStoredSession('https://hodman.ai')
    expect(await getStoredSession('https://hodman.ai')).toBeNull()
  })
})
