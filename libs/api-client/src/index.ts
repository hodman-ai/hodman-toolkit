import type {
  THodmanApiError,
  THodmanAppConnectionOverview,
  THodmanFileContent,
  THodmanFileNode,
  THodmanGitConnection,
  THodmanLogsResponse,
  THodmanMessage,
  THodmanProfile,
  THodmanProject,
  THodmanProjectEnv,
  THodmanProjectMessengerSettings,
  THodmanRelease,
  THodmanShellResponse,
  THodmanSqlResponse,
  THodmanTenantRecord,
  THodmanTelegramAccessRequest,
  THodmanTelegramStatus,
  THodmanThread,
  TListResponse,
} from '@hodman-ai/api-contract'

export type TokenProvider = () => Promise<string | null>
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  authenticated?: boolean
  rotateRefreshToken?: boolean
  timeoutMs?: number
}

export class HodmanApiError extends Error {
  readonly code: string
  readonly status: number
  readonly description?: string

  constructor(code: string, status: number, description?: string) {
    super(description ? `${code}: ${description}` : code)
    this.name = 'HodmanApiError'
    this.code = code
    this.status = status
    this.description = description
  }
}

export function normalizeHost(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('host_must_include_http_scheme')
  }
  return trimmed
}

export class HodmanApiClient {
  readonly host: string

  constructor(host: string, private readonly tokenProvider?: TokenProvider) {
    this.host = normalizeHost(host)
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, `${this.host}/`)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }

    const authenticated = options.authenticated !== false
    const token = authenticated && this.tokenProvider ? await this.tokenProvider() : null
    if (authenticated && this.tokenProvider && !token) {
      throw new HodmanApiError('not_authenticated', 401)
    }

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      ...(options.timeoutMs ? { signal: AbortSignal.timeout(options.timeoutMs) } : {}),
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.rotateRefreshToken ? { 'X-Refresh-Token-Rotation': '1' } : {}),
        'User-Agent': 'hodman-toolkit-cli/0.3.0',
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    })
    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        throw new HodmanApiError('invalid_json_response', response.status, text.slice(0, 300))
      }
    }
    if (!response.ok) {
      const error = payload && typeof payload === 'object' ? payload as Partial<THodmanApiError> : {}
      throw new HodmanApiError(error.err ?? `http_${response.status}`, response.status, error.errDescription)
    }
    return payload as T
  }

  login(body: { email?: string; username?: string; password: string }) {
    return this.request<{ accessToken: string; refreshToken: string }>('/auth/core/login', {
      method: 'POST', body, authenticated: false,
    })
  }

  refresh(refreshToken: string, rotateRefreshToken = true) {
    return this.request<{ accessToken: string; refreshToken?: string }>('/auth/core/token', {
      method: 'POST', body: { refreshToken }, authenticated: false, rotateRefreshToken, timeoutMs: 20_000,
    })
  }

  logout(refreshToken: string) {
    return this.request<{ status: string }>('/auth/core/logout', {
      method: 'POST', body: { refreshToken }, authenticated: false, timeoutMs: 20_000,
    })
  }

  profile() {
    return this.request<THodmanProfile>('/auth/core/profile')
  }

  tenants(limit = 20, offset = 0, search?: string) {
    return this.request<TListResponse<THodmanTenantRecord>>('/auth/tenants', {
      query: { limit, offset, search },
    })
  }

  async tenantByName(name: string) {
    const response = await this.request<TListResponse<THodmanTenantRecord>>('/auth/tenants', {
      query: { tenant: name, search: name, limit: 100, offset: 0 },
    })
    return response.result.find((tenant) => tenant.name === name) ?? null
  }

  projects(tenant: string, limit = 100, offset = 0) {
    return this.request<TListResponse<THodmanProject>>('/api/projects', { query: { tenant, limit, offset } })
  }

  project(tenant: string, projectId: string) {
    return this.request<THodmanProject>(`/api/projects/${encodeURIComponent(projectId)}`, { query: { tenant } })
  }

  provisionProject(tenant: string, body: Record<string, unknown>) {
    return this.request<{ project: THodmanProject; threadId: string }>('/api/projects/provision', {
      method: 'POST', query: { tenant }, body,
    })
  }

  provisionSubProject(tenant: string, parentProjectId: string, body: Record<string, unknown>) {
    return this.request<{ project: THodmanProject; threadId: string }>(
      `/api/projects/${encodeURIComponent(parentProjectId)}/subprojects/provision`,
      { method: 'POST', query: { tenant }, body },
    )
  }

  patchProject(tenant: string, projectId: string, body: Record<string, unknown>) {
    return this.request<THodmanProject>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH', query: { tenant }, body,
    })
  }

  projectOperation(tenant: string, projectId: string, operation: 'run' | 'build' | 'stop') {
    return this.request<{ ok: true }>(`/api/projects/${encodeURIComponent(projectId)}/dev/${operation}`, {
      method: 'POST', query: { tenant }, body: {},
    })
  }

  publishProject(tenant: string, projectId: string) {
    return this.request<{ status: 'running'; startedAt: number }>(`/api/projects/${encodeURIComponent(projectId)}/publish`, {
      method: 'POST', query: { tenant }, body: {},
    })
  }

  publishStatus(tenant: string, projectId: string) {
    return this.request<Record<string, unknown>>(`/api/projects/${encodeURIComponent(projectId)}/publish-status`, { query: { tenant } })
  }

  releases(tenant: string, projectId: string, limit = 50, offset = 0) {
    return this.request<TListResponse<THodmanRelease>>('/api/releases', {
      query: { tenant, projectId, limit, offset, sortby: 'id', sortdir: 'desc' },
    })
  }

  release(tenant: string, releaseId: string) {
    return this.request<THodmanRelease>(`/api/releases/${encodeURIComponent(releaseId)}`, { query: { tenant } })
  }

  threads(tenant: string, projectId: string, limit = 200, offset = 0) {
    return this.request<TListResponse<THodmanThread>>('/api/threads', { query: { tenant, projectId, limit, offset } })
  }

  thread(tenant: string, threadId: string) {
    return this.request<THodmanThread>(`/api/threads/${encodeURIComponent(threadId)}`, { query: { tenant } })
  }

  createThread(tenant: string, body: Record<string, unknown>) {
    return this.request<THodmanThread>('/api/threads', { method: 'POST', query: { tenant }, body })
  }

  patchThread(tenant: string, threadId: string, body: Record<string, unknown>) {
    return this.request<THodmanThread>(`/api/threads/${encodeURIComponent(threadId)}`, {
      method: 'PATCH', query: { tenant }, body,
    })
  }

  messages(tenant: string, threadId: string, limit = 300, offset = 0) {
    return this.request<TListResponse<THodmanMessage>>('/api/messages', {
      query: { tenant, threadId, limit, offset, sortby: 'id', sortdir: 'asc' },
    })
  }

  createMessage(tenant: string, body: Record<string, unknown>) {
    return this.request<THodmanMessage>('/api/messages', { method: 'POST', query: { tenant }, body })
  }

  executeTaskTool(tenant: string, threadId: string, toolName: string, args: Record<string, unknown>) {
    return this.request<{ output: Record<string, unknown>; startThread: unknown | null }>('/api/agent-task-tools/execute', {
      method: 'POST', query: { tenant }, body: { threadId, toolName, args },
    })
  }

  projectEnvs(tenant: string, projectId: string, env: 'dev' | 'prod') {
    return this.request<TListResponse<THodmanProjectEnv>>('/api/project-envs', {
      query: { tenant, projectId, env, limit: 10 },
    })
  }

  createProjectEnv(tenant: string, body: Record<string, unknown>) {
    return this.request<THodmanProjectEnv>('/api/project-envs', { method: 'POST', query: { tenant }, body })
  }

  patchProjectEnv(tenant: string, uuid: string, body: Record<string, unknown>) {
    return this.request<THodmanProjectEnv>(`/api/project-envs/${encodeURIComponent(uuid)}`, {
      method: 'PATCH', query: { tenant }, body,
    })
  }

  fileTree(tenant: string, projectId: string) {
    return this.request<{ result: THodmanFileNode[] }>('/api/files/tree', { query: { tenant, projectId } })
  }

  fileContent(tenant: string, projectId: string, path: string) {
    return this.request<THodmanFileContent>('/api/files/content', { query: { tenant, projectId, path } })
  }

  saveFile(tenant: string, body: { projectId: string; path: string; content: string }) {
    return this.request<{ ok: true }>('/api/files/save', { method: 'POST', query: { tenant }, body })
  }

  mkdir(tenant: string, body: { projectId: string; path: string }) {
    return this.request<{ ok: true }>('/api/files/mkdir', { method: 'POST', query: { tenant }, body })
  }

  lockProject(tenant: string, projectId: string, connectionId: string) {
    return this.request<Record<string, unknown>>('/api/project-locks/lock', {
      method: 'POST', query: { tenant }, body: { projectId, connectionId },
    })
  }

  unlockProject(tenant: string, projectId: string, connectionId: string) {
    return this.request<Record<string, unknown>>('/api/project-locks/unlock', {
      method: 'POST', query: { tenant }, body: { projectId, connectionId },
    })
  }

  shell(tenant: string, body: { projectId: string; command: string; env?: 'dev' | 'prod'; timeoutMs?: number }) {
    return this.request<THodmanShellResponse>('/api/project-tools/shell', { method: 'POST', query: { tenant }, body })
  }

  sql(tenant: string, body: { projectId: string; query: string; env?: 'dev' | 'prod' }) {
    return this.request<THodmanSqlResponse>('/api/project-tools/sql', { method: 'POST', query: { tenant }, body })
  }

  logs(tenant: string, projectId: string, env: 'dev' | 'prod', limit: number) {
    return this.request<THodmanLogsResponse>('/api/project-tools/logs', { query: { tenant, projectId, env, limit } })
  }

  gitConnections(tenant: string, projectId: string) {
    return this.request<TListResponse<THodmanGitConnection>>('/api/git-connections', {
      query: { tenant, projectId, limit: 100 },
    })
  }

  gitConnection(tenant: string, uuid: string) {
    return this.request<THodmanGitConnection>(`/api/git-connections/${encodeURIComponent(uuid)}`, { query: { tenant } })
  }

  createGitConnection(tenant: string, body: Record<string, unknown>) {
    return this.request<THodmanGitConnection>('/api/git-connections', { method: 'POST', query: { tenant }, body })
  }

  deleteGitConnection(tenant: string, uuid: string) {
    return this.request<{ uuid: string }>(`/api/git-connections/${encodeURIComponent(uuid)}`, {
      method: 'DELETE', query: { tenant },
    })
  }

  githubStart(tenant: string, body: { projectId?: string; returnTo?: string }) {
    return this.request<{ url: string }>('/api/github/app/start', { method: 'POST', body: { tenant, ...body } })
  }

  githubRepositories(tenant: string, connectionId?: string) {
    return this.request<{ result: unknown[] }>('/api/github/repositories', { query: { tenant, connectionId } })
  }

  projectMessengers(tenant: string, projectId: string) {
    return this.request<THodmanProjectMessengerSettings>('/api/project-messengers', {
      query: { tenant, projectId },
    })
  }

  telegramStatus(tenant: string, projectId: string) {
    return this.request<THodmanTelegramStatus>(`/api/project-telegram/${encodeURIComponent(projectId)}`, { query: { tenant } })
  }

  telegramConnect(tenant: string, projectId: string, botToken: string) {
    return this.request<THodmanTelegramStatus>(`/api/project-telegram/${encodeURIComponent(projectId)}/token`, {
      method: 'PATCH', query: { tenant }, body: { botToken },
    })
  }

  telegramDisconnect(tenant: string, projectId: string) {
    return this.request<{ ok: true }>(`/api/project-telegram/${encodeURIComponent(projectId)}/token`, {
      method: 'DELETE', query: { tenant },
    })
  }

  telegramRefresh(tenant: string, projectId: string) {
    return this.request<THodmanTelegramStatus>(`/api/project-telegram/${encodeURIComponent(projectId)}/refresh`, {
      method: 'POST', query: { tenant }, body: {},
    })
  }

  telegramAddChat(tenant: string, projectId: string, externalId: string) {
    return this.request<THodmanTelegramStatus>(
      `/api/project-telegram/${encodeURIComponent(projectId)}/chats/${encodeURIComponent(externalId)}`,
      { method: 'POST', query: { tenant }, body: {} },
    )
  }

  telegramRemoveChat(tenant: string, projectId: string, externalId: string) {
    return this.request<THodmanTelegramStatus>(
      `/api/project-telegram/${encodeURIComponent(projectId)}/chats/${encodeURIComponent(externalId)}`,
      { method: 'DELETE', query: { tenant } },
    )
  }

  telegramRequests(tenant: string, projectId: string, params: {
    status?: 'pending' | 'history' | 'all'
    search?: string
    limit?: number
    offset?: number
  }) {
    return this.request<TListResponse<THodmanTelegramAccessRequest>>(
      `/api/project-telegram/${encodeURIComponent(projectId)}/access-requests`,
      { query: { tenant, ...params } },
    )
  }

  telegramDecideRequest(tenant: string, projectId: string, requestId: string, decision: 'approve' | 'reject') {
    return this.request<THodmanTelegramAccessRequest>(
      `/api/project-telegram/${encodeURIComponent(projectId)}/access-requests/${encodeURIComponent(requestId)}`,
      { method: 'PATCH', query: { tenant }, body: { decision } },
    )
  }

  telegramSend(tenant: string, projectId: string, externalId: string, text: string) {
    return this.request<{ messageId: number; messageIds?: number[] }>(`/api/project-telegram/${encodeURIComponent(projectId)}/send`, {
      method: 'POST', query: { tenant }, body: { externalId, text },
    })
  }

  appConnections(tenant: string) {
    return this.request<THodmanAppConnectionOverview>('/api/tenant-project-cli', { query: { tenant } })
  }

  createAppConnection(tenant: string, targetProjectId: string) {
    return this.request<{ uuid: string; targetProjectId: string; createdAt: string | null }>('/api/tenant-project-cli', {
      method: 'POST', body: { tenant, targetProjectId },
    })
  }

  probeAppConnection(tenant: string, targetProjectId: string) {
    return this.request<{ available: boolean; help: string | null; err: string | null }>('/api/tenant-project-cli/probe', {
      method: 'POST', body: { tenant, targetProjectId },
    })
  }

  deleteAppConnection(tenant: string, targetProjectId: string) {
    return this.request<{ targetProjectId: string }>(`/api/tenant-project-cli/${encodeURIComponent(targetProjectId)}`, {
      method: 'DELETE', query: { tenant },
    })
  }

  setAppConnectionGrants(tenant: string, targetProjectId: string, sourceProjectIds: string[]) {
    return this.request<{ targetProjectId: string; sourceProjectIds: string[] }>(
      `/api/tenant-project-cli/${encodeURIComponent(targetProjectId)}`,
      { method: 'PATCH', body: { tenant, sourceProjectIds } },
    )
  }
}
