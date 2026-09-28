export type THodmanTelegramChat = {
  externalId: string
  externalType: 'private' | 'group' | 'supergroup' | 'channel' | 'unknown'
  title: string | null
  username: string | null
  lastSeenAt: string | null
}

export type THodmanTelegramStatus = {
  integrationId: string | null
  rootProjectId: string
  inherited: boolean
  configured: boolean
  status: 'active' | 'error' | 'disabled' | null
  botUserId: string | null
  botUsername: string | null
  canReadAllGroupMessages: boolean | null
  botInfoRefreshedAt: string | null
  maskedBotToken: string | null
  lastError: string | null
  allowedChatIds: string[]
  allowedChats: THodmanTelegramChat[]
}

export type THodmanTelegramAccessRequest = {
  uuid: string
  createdAt: string | null
  updatedAt: string | null
  externalId: string
  externalType: 'private' | 'group' | 'supergroup' | 'channel' | 'unknown'
  title: string | null
  username: string | null
  senderId: string | null
  senderUsername: string | null
  senderName: string | null
  messagePreview: string | null
  messageCount: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  status: 'pending' | 'approved' | 'rejected'
  resolvedProjectId: string | null
  resolvedAt: string | null
}

export type THodmanMessengerProvider = 'telegram' | 'mattermost' | 'slack' | 'teams'

export type THodmanMessengerConnectorDefinition = {
  provider: THodmanMessengerProvider
  title: string
  description: string
  available: boolean
  accountModes: Array<'dedicated-agent' | 'business-operator' | 'personal-operator'>
  credentialFields: Array<{
    key: string
    label: string
    description: string
    secret: boolean
    required: boolean
    inputType: 'password' | 'url' | 'text'
    placeholder?: string
  }>
  setupSteps: string[]
  capabilities: {
    text: boolean
    files: boolean
    replies: boolean
    edit: boolean
    delete: boolean
    reactions: boolean
    typing: boolean
    channelMessages: boolean
    directMessages: boolean
    mentionActivation: boolean
  }
}

export type THodmanMessengerConnectionState = {
  id: string
  connected: boolean
  status: 'connecting' | 'active' | 'error' | 'disabled'
  accountMode: 'dedicated-agent' | 'business-operator' | 'personal-operator'
  baseUrl: string | null
  identity: {
    serverId: string
    accountId: string
    username: string | null
    displayName: string | null
  } | null
  healthStatus: 'healthy' | 'degraded' | 'offline' | null
  lastHealthAt: string | null
  lastErrorCode: string | null
  hasCredential: boolean
}

export type THodmanMessengerRoute = {
  uuid: string
  providerConversationId: string
  conversationKind: 'dm' | 'channel' | 'group'
  teamId: string | null
  title: string | null
  authorizationMode: 'explicit-request' | 'provider-membership' | 'trusted-workspace'
  activationMode: 'dm' | 'mention-only' | 'command-only' | 'every-message'
  allowedActorIds: string[] | null
  status: 'active' | 'disabled'
}

export type THodmanProjectMessengerSettings = {
  canManage: boolean
  connectors: Array<{
    definition: THodmanMessengerConnectorDefinition
    state: THodmanMessengerConnectionState
  }>
  mattermostRoutes: THodmanMessengerRoute[]
  slackRoutes: THodmanMessengerRoute[]
  teamsRoutes: THodmanMessengerRoute[]
}

export type THodmanAppConnectionOverview = {
  canManage: boolean
  projects: Array<{
    uuid: string
    title: string
    slug: string | null
    projectKind: string | null
    parentProjectId: string | null
    developmentRuntimeMode: string | null
    runtimePlacement: string | null
  }>
  connectors: Array<{ uuid: string; targetProjectId: string; createdAt: string | null }>
  grants: Array<{ uuid: string; sourceProjectId: string; targetProjectId: string; createdAt: string | null }>
}
