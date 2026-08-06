import { HodmanApiClient } from '@hodman-ai/api-client'

import { readConfig } from './config.js'
import { getStoredSession, jwtExpiresAt, setStoredSession, type StoredSession } from './credentials.js'

export class CliSession {
  private configPromise = readConfig()
  private refreshPromise: Promise<string> | null = null

  async host(): Promise<string> {
    return (await this.configPromise).host
  }

  async accessToken(): Promise<string | null> {
    const host = await this.host()
    const stored = await getStoredSession(host)
    if (!stored) return null
    const expiry = stored.accessTokenExpiresAt ?? (stored.accessToken ? jwtExpiresAt(stored.accessToken) : null)
    if (stored.accessToken && (!expiry || expiry > Date.now() + 30_000)) return stored.accessToken
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh(host, stored).finally(() => {
        this.refreshPromise = null
      })
    }
    return this.refreshPromise
  }

  private async refresh(host: string, stored: StoredSession): Promise<string> {
    const client = new HodmanApiClient(host)
    const result = await client.refresh(stored.refreshToken)
    const next: StoredSession = {
      ...stored,
      accessToken: result.accessToken,
      accessTokenExpiresAt: jwtExpiresAt(result.accessToken),
    }
    await setStoredSession(host, next)
    return result.accessToken
  }

  async client(): Promise<HodmanApiClient> {
    return new HodmanApiClient(await this.host(), () => this.accessToken())
  }
}
