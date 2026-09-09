import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { deleteStoredSession, getStoredSession, setStoredSession, withRefreshLock } from './credentials.js'

let dir = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hodman-cli-test-'))
  process.env.HODMAN_CONFIG_DIR = dir
  process.env.HODMAN_CREDENTIAL_BACKEND = 'file'
  delete process.env.HODMAN_REFRESH_TOKEN
})

afterEach(async () => {
  delete process.env.HODMAN_CONFIG_DIR
  delete process.env.HODMAN_CREDENTIAL_BACKEND
  delete process.env.HODMAN_REFRESH_TOKEN
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

  it('fails closed instead of overwriting a corrupted fallback file', async () => {
    const target = path.join(dir, 'credentials.json')
    await fs.writeFile(target, '{not-json', { mode: 0o600 })

    await expect(getStoredSession('https://hodman.ai')).rejects.toThrow('credential_store_corrupted_file')
    await expect(setStoredSession('https://hodman.ai', {
      refreshToken: 'replacement', accessToken: null, accessTokenExpiresAt: null, userLabel: null,
    })).rejects.toThrow('credential_store_corrupted_file')
    await expect(fs.readFile(target, 'utf8')).resolves.toBe('{not-json')
  })

  it('recovers an old lock only when its owner process is gone', async () => {
    const host = 'https://hodman.ai'
    const hostHash = crypto.createHash('sha256').update(host).digest('hex').slice(0, 24)
    const lock = path.join(dir, `refresh-${hostHash}.lock`)
    await fs.writeFile(lock, JSON.stringify({ pid: 2_147_483_647, nonce: 'abandoned', createdAt: 0 }), { mode: 0o600 })
    const old = new Date(Date.now() - 180_000)
    await fs.utimes(lock, old, old)

    await expect(withRefreshLock(host, async () => 'recovered')).resolves.toBe('recovered')
    await expect(fs.access(lock)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not lose sessions when different hosts are written concurrently', async () => {
    await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      await setStoredSession(`https://host-${index}.example`, {
        refreshToken: `refresh-${index}`,
        accessToken: null,
        accessTokenExpiresAt: null,
        userLabel: `user-${index}`,
      })
    }))

    const sessions = await Promise.all(Array.from({ length: 8 }, (_, index) => (
      getStoredSession(`https://host-${index}.example`)
    )))
    expect(sessions.map((session) => session?.refreshToken)).toEqual(
      Array.from({ length: 8 }, (_, index) => `refresh-${index}`),
    )
  })
})
