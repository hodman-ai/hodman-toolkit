import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { configDir } from './config.js'

export type StoredSession = {
  refreshToken: string
  accessToken: string | null
  accessTokenExpiresAt: number | null
  userLabel: string | null
}

export type CredentialSource = 'environment' | 'keyring' | 'file'

export type ResolvedSession = {
  source: CredentialSource
  session: StoredSession
}

type FileCredentialStore = {
  hosts: Record<string, StoredSession>
}

type LockOwner = {
  pid: number
  nonce: string
  createdAt: number
}

const SERVICE_NAME = 'hodman-toolkit'
const CREDENTIAL_LOCK_WAIT_MS = 30_000
const CREDENTIAL_LOCK_STALE_MS = 120_000

function accountForHost(host: string): string {
  return host.toLowerCase().replace(/\/+$/, '')
}

function credentialFilePath(): string {
  return path.join(configDir(), 'credentials.json')
}

function refreshLockPath(host: string): string {
  const hostHash = crypto.createHash('sha256').update(accountForHost(host)).digest('hex').slice(0, 24)
  return path.join(configDir(), `refresh-${hostHash}.lock`)
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<StoredSession>
  return typeof session.refreshToken === 'string'
    && (session.accessToken === null || typeof session.accessToken === 'string')
    && (session.accessTokenExpiresAt === null || typeof session.accessTokenExpiresAt === 'number')
    && (session.userLabel === null || typeof session.userLabel === 'string')
}

function parseStoredSession(raw: string, source: 'keyring' | 'file'): StoredSession {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`credential_store_corrupted_${source}`)
  }
  if (!isStoredSession(parsed)) throw new Error(`credential_store_corrupted_${source}`)
  return parsed
}

async function keyringEntry(host: string): Promise<{
  getPassword(): string | null
  setPassword(password: string): void
  deletePassword(): void
} | null> {
  if (process.env.HODMAN_CREDENTIAL_BACKEND === 'file') return null
  try {
    const module = await import('@napi-rs/keyring')
    return new module.Entry(SERVICE_NAME, accountForHost(host))
  } catch {
    return null
  }
}

async function readFileStore(): Promise<FileCredentialStore> {
  let content: string
  try {
    content = await fs.readFile(credentialFilePath(), 'utf8')
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code === 'ENOENT') return { hosts: {} }
    throw error
  }

  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('credential_store_corrupted_file')
  }
  if (!raw || typeof raw !== 'object' || !('hosts' in raw) || !raw.hosts || typeof raw.hosts !== 'object') {
    throw new Error('credential_store_corrupted_file')
  }
  const hosts = raw.hosts as Record<string, unknown>
  if (Object.values(hosts).some((session) => !isStoredSession(session))) {
    throw new Error('credential_store_corrupted_file')
  }
  return { hosts: hosts as Record<string, StoredSession> }
}

async function writeFileStore(store: FileCredentialStore): Promise<void> {
  const dir = configDir()
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  const target = credentialFilePath()
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    const handle = await fs.open(temp, 'wx', 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(store, null, 2)}\n`)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await fs.rename(temp, target)
    await fs.chmod(target, 0o600)
  } finally {
    await fs.unlink(temp).catch(() => undefined)
  }
}

export async function resolveSession(host: string): Promise<ResolvedSession | null> {
  const envToken = String(process.env.HODMAN_REFRESH_TOKEN ?? '').trim()
  if (envToken) {
    return {
      source: 'environment',
      session: { refreshToken: envToken, accessToken: null, accessTokenExpiresAt: null, userLabel: null },
    }
  }
  const entry = await keyringEntry(host)
  if (entry) {
    let value: string | null = null
    try {
      value = entry.getPassword()
    } catch {
      // Headless systems may have the native module but no usable keyring service.
    }
    if (value) return { source: 'keyring', session: parseStoredSession(value, 'keyring') }
  }
  const store = await readFileStore()
  const session = store.hosts[accountForHost(host)]
  return session ? { source: 'file', session } : null
}

export async function getStoredSession(host: string): Promise<StoredSession | null> {
  return (await resolveSession(host))?.session ?? null
}

export async function setStoredSession(host: string, session: StoredSession): Promise<void> {
  const entry = await keyringEntry(host)
  if (entry) {
    try {
      entry.setPassword(JSON.stringify(session))
      return
    } catch {
      // Fall back to a permission-restricted local file when OS keyring is unavailable.
    }
  }
  await withFileLock(path.join(configDir(), 'credentials.lock'), async () => {
    const store = await readFileStore()
    store.hosts[accountForHost(host)] = session
    await writeFileStore(store)
  })
}

export async function deleteStoredSession(host: string): Promise<void> {
  const entry = await keyringEntry(host)
  if (entry) {
    try {
      entry.deletePassword()
    } catch {
      // Also clear the file fallback below.
    }
  }
  await withFileLock(path.join(configDir(), 'credentials.lock'), async () => {
    const store = await readFileStore()
    delete store.hosts[accountForHost(host)]
    await writeFileStore(store)
  })
}

function parseLockOwner(raw: string): LockOwner | null {
  try {
    const value = JSON.parse(raw) as Partial<LockOwner>
    return Number.isInteger(value.pid) && Number(value.pid) > 0
      && typeof value.nonce === 'string' && value.nonce.length > 0
      && typeof value.createdAt === 'number'
      ? { pid: Number(value.pid), nonce: value.nonce, createdAt: value.createdAt }
      : null
  } catch {
    return null
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    return code !== 'ESRCH'
  }
}

async function removeLockIfOwned(target: string, owner: string): Promise<void> {
  try {
    const currentOwner = await fs.readFile(target, 'utf8')
    if (currentOwner === owner) await fs.unlink(target)
  } catch {
    // The lock may already have been removed after its owner exited.
  }
}

async function breakAbandonedLock(target: string): Promise<boolean> {
  let raw: string
  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    const lockState = await Promise.all([fs.readFile(target, 'utf8'), fs.stat(target)])
    raw = lockState[0]
    stat = lockState[1]
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    return code === 'ENOENT'
  }
  const owner = parseLockOwner(raw)
  if (Date.now() - stat.mtimeMs <= CREDENTIAL_LOCK_STALE_MS || (owner && processIsAlive(owner.pid))) return false

  const claim = `${target}.claim-${process.pid}-${crypto.randomUUID()}`
  try {
    await fs.link(target, claim)
    const [targetStat, claimStat, claimOwner] = await Promise.all([
      fs.stat(target),
      fs.stat(claim),
      fs.readFile(claim, 'utf8'),
    ])
    if (targetStat.dev !== claimStat.dev || targetStat.ino !== claimStat.ino || claimOwner !== raw) return false
    await fs.unlink(target)
    return true
  } catch {
    return false
  } finally {
    await fs.unlink(claim).catch(() => undefined)
  }
}

async function withFileLock<T>(target: string, action: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
  const owner = JSON.stringify({ pid: process.pid, nonce: crypto.randomUUID(), createdAt: Date.now() })
  const deadline = Date.now() + CREDENTIAL_LOCK_WAIT_MS

  while (true) {
    let handle: Awaited<ReturnType<typeof fs.open>>
    try {
      handle = await fs.open(target, 'wx', 0o600)
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (code !== 'EEXIST') throw error
      if (await breakAbandonedLock(target)) continue
      if (Date.now() >= deadline) throw new Error('credential_lock_timeout')
      await new Promise((resolve) => setTimeout(resolve, 100))
      continue
    }

    try {
      await handle.writeFile(owner)
      await handle.sync()
      return await action()
    } finally {
      await handle.close()
      await removeLockIfOwned(target, owner)
    }
  }
}

export async function withRefreshLock<T>(host: string, action: () => Promise<T>): Promise<T> {
  return withFileLock(refreshLockPath(host), action)
}

export function jwtExpiresAt(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}
