export type {
  THodmanAppConnectionOverview,
  THodmanMessengerConnectionState,
  THodmanMessengerConnectorDefinition,
  THodmanMessengerProvider,
  THodmanMessengerRoute,
  THodmanProjectMessengerSettings,
  THodmanTelegramAccessRequest,
  THodmanTelegramChat,
  THodmanTelegramStatus,
} from './messengers.js'

export type TListResponse<T> = {
  result: T[]
  total: number
  limit: number
  offset: number
}

export type THodmanTenant = {
  uuid: string
  name: string
  displayName: string
  tenantType: 'tenant-management' | 'customer-tenant'
  status: 'freemium' | 'working' | 'banned' | 'archive'
  location?: string | null
  scopes: string[]
  roles: Array<'manage'>
  owner: boolean
  current: boolean
}

export type THodmanTenantRecord = {
  id: number
  uuid: string
  createdAt?: string | null
  updatedAt?: string | null
  name: string
  displayName: string
  ownerUserId?: string | null
  tenantType: 'tenant-management' | 'customer-tenant'
  location: string
  status: 'freemium' | 'working' | 'banned' | 'archive'
  logoAssetId?: string | null
  logoUrl?: string | null
  parentTenantName?: string | null
}

export type THodmanProfile = {
  user: {
    uuid: string
    tenant?: string | null
    name: string
    email?: string | null
    username?: string | null
  }
  tenants: THodmanTenant[]
}

export type THodmanRelease = {
  id: number
  uuid: string
  createdAt?: string | null
  updatedAt?: string | null
  tenant: string
  projectId: string
  sequence: number
  snapshotUuid: string
  previousReleaseId?: string | null
  publishedRevision?: number | null
  publishedAt: string
  url: string
  includedThreadIds?: string[] | null
  review?: string | null
  reviewStatus: 'generating' | 'ready' | 'error'
  reviewModel?: string | null
  reviewError?: string | null
  gitTag?: string | null
  gitStatus: 'pending' | 'success' | 'error' | 'skipped'
  gitError?: string | null
}

export type THodmanProject = {
  uuid: string
  tenant: string
  title: string
  slug?: string | null
  projectKind?: 'project' | 'sub-project' | null
  parentProjectId?: string | null
  pathname?: string | null
  projectType?: string | null
  projectDescription?: string | null
  runtimePlacement?: 'server' | 'desktop' | null
  developmentRuntimeMode?: 'ephemeral-v1' | 'persistent-v2' | null
  visibility?: 'tenant' | 'personal' | null
  ownerUserId?: string | null
  runCmd?: string | null
  buildCmd?: string | null
  dockerImage?: string | null
  port?: string | null
  revision?: number | null
  devRevision?: number | null
  publishedRevision?: number | null
  [key: string]: unknown
}

export type THodmanThread = {
  uuid: string
  tenant: string
  projectId: string
  name?: string | null
  runStatus?: 'idle' | 'queued' | 'running' | 'waiting' | 'error'
  threadStatus?: 'inbox' | 'backlog' | 'todo' | 'in-progress' | 'done' | null
  taskMode?: 'work' | 'readonly' | null
  boardProjectId?: string | null
  assigneeProjectId?: string | null
  requesterProjectId?: string | null
  priorityRank?: number | null
  err?: string | null
  goalObjective?: string | null
  goalStatus?: 'active' | 'complete' | 'blocked' | 'budget_limited' | 'cancelled' | null
  goalTokenBudget?: number | null
  goalTokensUsed?: number | null
  goalTurnBudget?: number | null
  goalTurnsUsed?: number | null
  goalStartedAt?: string | null
  goalCompletedAt?: string | null
  goalRevision?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  [key: string]: unknown
}

export type THodmanMessage = {
  uuid: string
  tenant: string
  threadId: string
  role: string
  textContent?: string | null
  contentType?: 'explanation' | 'report' | null
  messagePhase?: 'commentary' | 'final_answer' | null
  deliverySuppressed?: boolean
  createdAt?: string | null
  createdByType?: string | null
  [key: string]: unknown
}

export type THodmanProjectEnv = {
  uuid: string
  tenant: string
  projectId: string
  env: 'dev' | 'prod'
  values?: Record<string, string> | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type THodmanGitConnection = {
  uuid: string
  tenant: string
  projectId: string
  host: string
  authorizationType: 'credentials' | 'ssh-key'
  login?: string | null
  password?: string | null
  privateKey?: string | null
  provider?: 'manual' | 'github' | null
  repositoryFullName?: string | null
  repositoryName?: string | null
  repositoryId?: string | null
  defaultBranch?: string | null
  [key: string]: unknown
}

export type THodmanLogEntry = {
  createdAt: string
  stream: 'stdout' | 'stderr'
  content: string
  projectId: string
  threadId: string
}

export type THodmanLogsResponse = {
  ok: true
  total: number
  entries: THodmanLogEntry[]
  truncated?: boolean
}

export type THodmanShellResponse = {
  ok: true
  exitCode: number
  stdout: string
  stderr: string
  truncated: boolean
}

export type THodmanSqlResponse = {
  ok: true
  rows: unknown
  truncated: boolean
}

export type THodmanFileNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  children?: THodmanFileNode[]
}

export type THodmanFileContent = {
  content: string
  mtime: string | null
  isBinary: boolean
  mimeType: string | null
  base64Content?: string | null
  size?: number | null
}

export type THodmanApiError = {
  err: string
  errDescription?: string
}
