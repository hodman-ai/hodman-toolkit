import { describe, expect, it } from 'vitest'

import { parseArgs } from './args.js'

describe('Slack discovery commands', () => {
  it('rejects Slack secrets before authentication or network discovery', async () => {
    process.env.HODMAN_CLI_NO_AUTO_RUN = '1'
    const { runCommand } = await import('./index.js')
    await expect(runCommand(parseArgs(['messengers', 'slack', 'setup', '--bot-token', 'xoxb-secret'])))
      .rejects.toThrow('slack_secrets_ui_only')
    await expect(runCommand(parseArgs(['messengers', 'slack', 'status', '--app-token=xapp-secret'])))
      .rejects.toThrow('slack_secrets_ui_only')
  })
})
