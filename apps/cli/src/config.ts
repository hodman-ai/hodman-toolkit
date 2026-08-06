import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { normalizeHost } from '@hodman-ai/api-client'

export type CliConfig = {
  host: string
  tenant: string | null
  projectId: string | null
}

export function configDir(): string {
  const override = String(process.env.HODMAN_CONFIG_DIR ?? '').trim()
  if (override) return path.resolve(override)
  if (process.platform === 'win32' && process.env.APPDATA) return path.join(process.env.APPDATA, 'hodman')
  const xdg = String(process.env.XDG_CONFIG_HOME ?? '').trim()
  return xdg ? path.join(xdg, 'hodman') : path.join(os.homedir(), '.config', 'hodman')
}

export function configPath(): string {
  return path.join(configDir(), 'config.json')
}

const defaultConfig: CliConfig = {
  host: 'https://hodman.ai',
  tenant: null,
  projectId: null,
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(configPath(), 'utf8')) as Partial<CliConfig>
    return {
      host: normalizeHost(String(process.env.HODMAN_HOST ?? raw.host ?? defaultConfig.host)),
      tenant: String(process.env.HODMAN_TENANT ?? raw.tenant ?? '').trim() || null,
      projectId: String(process.env.HODMAN_PROJECT ?? raw.projectId ?? '').trim() || null,
    }
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    return {
      ...defaultConfig,
      host: normalizeHost(String(process.env.HODMAN_HOST ?? defaultConfig.host)),
      tenant: String(process.env.HODMAN_TENANT ?? '').trim() || null,
      projectId: String(process.env.HODMAN_PROJECT ?? '').trim() || null,
    }
  }
}

export async function writeConfig(config: CliConfig): Promise<void> {
  const dir = configDir()
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  const target = configPath()
  const temp = `${target}.${process.pid}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  await fs.chmod(temp, 0o600)
  await fs.rename(temp, target)
  await fs.chmod(target, 0o600)
}

export async function patchConfig(patch: Partial<CliConfig>): Promise<CliConfig> {
  const next = { ...await readConfig(), ...patch }
  next.host = normalizeHost(next.host)
  await writeConfig(next)
  return next
}
