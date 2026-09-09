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
