import fs from 'node:fs/promises'
import path from 'node:path'

import { configDir } from './config.js'

export type StoredSession = {
  refreshToken: string
  accessToken: string | null
  accessTokenExpiresAt: number | null
  userLabel: string | null
}

type FileCredentialStore = {
  hosts: Record<string, StoredSession>
}

const SERVICE_NAME = 'hodman-toolkit'

function accountForHost(host: string): string {
  return host.toLowerCase().replace(/\/+$/, '')
}

function credentialFilePath(): string {
  return path.join(configDir(), 'credentials.json')
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
  try {
    const raw = JSON.parse(await fs.readFile(credentialFilePath(), 'utf8')) as Partial<FileCredentialStore>
    return { hosts: raw.hosts && typeof raw.hosts === 'object' ? raw.hosts : {} }
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    return { hosts: {} }
  }
}

async function writeFileStore(store: FileCredentialStore): Promise<void> {
  const dir = configDir()
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  const target = credentialFilePath()
  const temp = `${target}.${process.pid}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
  await fs.chmod(temp, 0o600)
  await fs.rename(temp, target)
  await fs.chmod(target, 0o600)
}

export async function getStoredSession(host: string): Promise<StoredSession | null> {
  const envToken = String(process.env.HODMAN_REFRESH_TOKEN ?? '').trim()
  if (envToken) {
    return { refreshToken: envToken, accessToken: null, accessTokenExpiresAt: null, userLabel: 'environment' }
  }
  const entry = await keyringEntry(host)
  if (entry) {
    try {
      const value = entry.getPassword()
      if (value) return JSON.parse(value) as StoredSession
    } catch {
      // Headless systems may have the native module but no usable keyring service.
    }
  }
  const store = await readFileStore()
  return store.hosts[accountForHost(host)] ?? null
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
  const store = await readFileStore()
  store.hosts[accountForHost(host)] = session
  await writeFileStore(store)
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
  const store = await readFileStore()
  delete store.hosts[accountForHost(host)]
  await writeFileStore(store)
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
