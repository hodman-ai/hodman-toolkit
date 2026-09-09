import { HodmanApiClient } from '@hodman-ai/api-client'

import { readConfig } from './config.js'
import {
  jwtExpiresAt,
  resolveSession,
  setStoredSession,
  withRefreshLock,
  type ResolvedSession,
  type StoredSession,
} from './credentials.js'

function validAccessToken(session: StoredSession): string | null {
  const expiry = session.accessTokenExpiresAt ?? (session.accessToken ? jwtExpiresAt(session.accessToken) : null)
  return session.accessToken && (!expiry || expiry > Date.now() + 30_000) ? session.accessToken : null
}

export class CliSession {
  private configPromise = readConfig()
  private refreshPromise: Promise<string> | null = null

  async host(): Promise<string> {
    return (await this.configPromise).host
  }

  async accessToken(): Promise<string | null> {
    const host = await this.host()
    const resolved = await resolveSession(host)
    if (!resolved) return null
    const accessToken = validAccessToken(resolved.session)
    if (accessToken) return accessToken
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh(host, resolved).finally(() => {
        this.refreshPromise = null
      })
    }
    return this.refreshPromise
  }

  private async refresh(host: string, resolved: ResolvedSession): Promise<string> {
    if (resolved.source === 'environment') {
      const client = new HodmanApiClient(host)
      const result = await client.refresh(resolved.session.refreshToken, false)
      return result.accessToken
    }

    return withRefreshLock(host, async () => {
      const latest = await resolveSession(host)
      if (!latest) throw new Error('not_authenticated')
      const currentAccessToken = validAccessToken(latest.session)
      if (currentAccessToken) return currentAccessToken

      if (latest.source === 'environment') {
        const client = new HodmanApiClient(host)
        const result = await client.refresh(latest.session.refreshToken, false)
        return result.accessToken
      }

      const client = new HodmanApiClient(host)
      const result = await client.refresh(latest.session.refreshToken, true)
      await setStoredSession(host, {
        ...latest.session,
        refreshToken: result.refreshToken ?? latest.session.refreshToken,
        accessToken: result.accessToken,
        accessTokenExpiresAt: jwtExpiresAt(result.accessToken),
      })
      return result.accessToken
    })
  }

  async client(): Promise<HodmanApiClient> {
    return new HodmanApiClient(await this.host(), () => this.accessToken())
  }
}
