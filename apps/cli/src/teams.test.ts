import { describe, expect, it } from 'vitest'
import { parseArgs } from './args.js'

describe('Teams CLI safety', () => {
  it('rejects Teams credentials on read-only setup and status commands', async () => {
    process.env.HODMAN_CLI_NO_AUTO_RUN = '1'
    const { runCommand } = await import('./index.js')
    await expect(runCommand(parseArgs(['messengers', 'teams', 'setup', '--client-secret', 'secret']))).rejects.toThrow('teams_secrets_ui_only')
    await expect(runCommand(parseArgs(['messengers', 'teams', 'status', '--token=secret']))).rejects.toThrow('teams_secrets_ui_only')
  })
})
