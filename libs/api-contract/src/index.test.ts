import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  THodmanMessengerConnectorDefinition,
  THodmanProjectMessengerSettings,
  THodmanTelegramStatus,
  THodmanThread,
  TListResponse,
} from './index.js'

const definition: THodmanMessengerConnectorDefinition = {
  provider: 'slack', title: 'Slack', description: 'Connector', available: true,
  accountModes: ['dedicated-agent'], credentialFields: [], setupSteps: [],
  capabilities: {
    text: true, files: false, replies: true, edit: false, delete: false,
    reactions: false, typing: false, channelMessages: true, directMessages: true,
    mentionActivation: true,
  },
}
const messengers: THodmanProjectMessengerSettings = {
  canManage: false, connectors: [{ definition, state: {
    id: 'connector-1', connected: false, status: 'disabled', accountMode: 'dedicated-agent',
    baseUrl: null, identity: null, healthStatus: null, lastHealthAt: null,
    lastErrorCode: null, hasCredential: false,
  } }], mattermostRoutes: [], slackRoutes: [], teamsRoutes: [],
}
const telegram: THodmanTelegramStatus = {
  integrationId: null, rootProjectId: 'project-1', inherited: false,
  configured: false, status: null, botUserId: null, botUsername: null,
  canReadAllGroupMessages: null, botInfoRefreshedAt: null,
  maskedBotToken: null, lastError: null, allowedChatIds: [], allowedChats: [],
}
const thread: THodmanThread = { uuid: 'thread-1', tenant: 'tenant-1', projectId: 'project-1', goalStatus: 'active' }
const page: TListResponse<THodmanThread> = { result: [thread], total: 1, limit: 20, offset: 0 }

// Fixtures are checked against exported DTOs by tsc during build, then exercised by node:test.
test('messenger connector DTO retains supported Slack capabilities and no credential value', () => {
  assert.equal(messengers.connectors[0]?.definition.provider, 'slack')
  assert.equal(messengers.connectors[0]?.definition.capabilities.mentionActivation, true)
  assert.equal(messengers.connectors[0]?.state.hasCredential, false)
})
test('Telegram status fixture is serializable with null unconfigured fields', () => {
  assert.equal(JSON.parse(JSON.stringify(telegram)).maskedBotToken, null)
  assert.deepEqual(telegram.allowedChats, [])
})
test('thread goal fields survive paginated contract', () => {
  assert.equal(page.result[0]?.goalStatus, 'active')
  assert.equal(page.total, 1)
})
