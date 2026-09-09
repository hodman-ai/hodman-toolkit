import crypto from 'node:crypto'
import fs from 'node:fs/promises'

import { HodmanApiClient, HodmanApiError, normalizeHost } from '@hodman-ai/api-client'
import type { THodmanGitConnection, THodmanMessage, THodmanProjectEnv } from '@hodman-ai/api-contract'

import { flag, numberOption, option, parseArgs, parseSetOptions, requiredOption, type ParsedArgs } from './args.js'
import {
  deleteStoredSession,
  jwtExpiresAt,
  resolveSession,
  setStoredSession,
  withRefreshLock,
} from './credentials.js'
import { patchConfig, readConfig } from './config.js'
import { promptHidden, promptLine, readStdin, readTextInput } from './input.js'
import { resolveProjectCreationPolicy, resolveProjectOwnership, resolveTaskStatus } from './policies.js'
import { CliSession } from './session.js'

const CLI_VERSION = '0.2.0'

type JsonObject = Record<string, unknown>

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function usage(): never {
  process.stdout.write(`Hodman CLI ${CLI_VERSION}

Authentication and context:
  hodman auth login [--host URL] [--email EMAIL | --username USER] [--password-stdin]
  hodman auth status
  hodman auth logout
  hodman host show
  hodman host set URL
  hodman tenant list [--limit 20] [--offset 0] [--search TEXT]
  hodman tenant current
  hodman tenant use NAME
  hodman project list|current
  hodman project use UUID
  hodman project show [--project UUID]
  hodman project create --slug SLUG [--intent PROJECT_INTENT] [--type custom|prompt] [--prompt TEXT|--prompt-file FILE] [--visibility personal|tenant] [--owner-user UUID]
  hodman project create-subproject [--project PARENT_UUID] --pathname PATH --prompt TEXT|--prompt-file FILE [--type web-app|landing-page|prompt] [--intent PROJECT_INTENT]
  hodman project update [--project UUID] --set key=value [--set key=value]
  hodman project run|build|stop|publish|publish-status [--project UUID]
  hodman project releases [--project UUID] [--limit 50] [--offset 0]
  hodman project release --release UUID

Projects are independent top-level products with their own host and settings. Sub-projects are
independently managed parts of one product, mounted at a pathname on the parent host. Use them
for separately built and published sites, applications, or agents that belong to the same product.
Sub-projects cannot be nested. After creation, select a sub-project by UUID and use the same
show, update, run, build, publish, release-history, file, ENV, log, shell, SQL, task, and Git commands.

Tasks and threads:
  hodman task list [--project UUID] [--status STATUS]
  hodman task show --task UUID
  hodman task create --title TEXT --message TEXT [--project UUID] [--status backlog|todo] [--wait]
  hodman task move --task UUID --status STATUS
  hodman task reply --task UUID --message TEXT
  hodman task complete --task UUID --message TEXT
  hodman thread messages --thread UUID
  hodman thread send --thread UUID --message TEXT [--wait] [--timeout SECONDS]

Messenger integrations:
  hodman messengers telegram status [--project UUID]
  hodman messengers telegram connect --token BOT_TOKEN [--project ROOT_UUID]
  hodman messengers telegram disconnect|refresh [--project ROOT_UUID]
  hodman messengers telegram chats list [--project UUID]
  hodman messengers telegram chats add|remove --chat TELEGRAM_CHAT_ID [--project UUID]
  hodman messengers telegram requests list [--project UUID] [--status pending|history|all] [--search TEXT]
  hodman messengers telegram requests approve|reject --request UUID [--project TARGET_UUID]
  hodman messengers telegram send --chat TELEGRAM_CHAT_ID --message TEXT [--project UUID]

App Connections:
  hodman connectors list
  hodman connectors probe|create|delete --target PROJECT_UUID
  hodman connectors grants set --target PROJECT_UUID --sources-json '["source-project-uuid"]'

Project tools:
  hodman env list [--project UUID] [--env dev|prod]
  hodman env get KEY --unsafe [--project UUID] [--env dev|prod]
  hodman env set KEY VALUE [--project UUID] [--env dev|prod]
  hodman env unset KEY [--project UUID] [--env dev|prod]
  hodman file tree [--project UUID]
  hodman file cat --path PATH [--project UUID]
  hodman file get --path PATH --output FILE [--project UUID]
  hodman file put --path PATH --local FILE [--project UUID]
  hodman file mkdir --path PATH [--project UUID]
  hodman shell exec --command COMMAND [--project UUID] [--env dev|prod] [--timeout SECONDS]
  hodman sql query --query SQL|--file FILE|--stdin [--project UUID] [--env dev|prod]
  hodman logs [--project UUID] [--env dev|prod] [--limit 20]

Git integrations:
  hodman git list [--project UUID]
  hodman git show --connection UUID
  hodman git add --host HOST --type credentials|ssh-key [--login USER] [--password-stdin|--private-key-file FILE]
  hodman git remove --connection UUID
  hodman git secret --connection UUID --field password|privateKey --unsafe
  hodman github connect [--project UUID]
  hodman github repos [--connection UUID]

All successful commands print JSON. Secrets require an exact key/field plus --unsafe.
`)
  process.exit(0)
}

function positional(args: ParsedArgs, index: number, error: string): string {
  const value = args.positionals[index]
  if (!value) throw new Error(error)
  return value
}

function environment(args: ParsedArgs): 'dev' | 'prod' {
  return option(args, 'env') === 'prod' ? 'prod' : 'dev'
}

async function context(args: ParsedArgs): Promise<{ tenant: string; projectId: string | null }> {
  const config = await readConfig()
  const tenant = String(option(args, 'tenant') ?? config.tenant ?? '').trim()
  if (!tenant) throw new Error('tenant_not_selected_run_hodman_tenant_use')
  return { tenant, projectId: String(option(args, 'project') ?? config.projectId ?? '').trim() || null }
}

async function projectContext(args: ParsedArgs): Promise<{ tenant: string; projectId: string }> {
  const current = await context(args)
  if (!current.projectId) throw new Error('project_not_selected_run_hodman_project_use')
  return { tenant: current.tenant, projectId: current.projectId }
}

async function authenticatedClient(): Promise<HodmanApiClient> {
  return new CliSession().client()
}

async function login(args: ParsedArgs): Promise<unknown> {
  if (String(process.env.HODMAN_REFRESH_TOKEN ?? '').trim()) {
    throw new Error('environment_credential_active_unset_HODMAN_REFRESH_TOKEN_before_login')
  }
  const current = await readConfig()
  const host = normalizeHost(option(args, 'host') ?? current.host)
  if (host !== current.host) await patchConfig({ host, tenant: null, projectId: null })
  const email = option(args, 'email')
  const username = option(args, 'username')
  const identifier = email || username || await promptLine('Email or username: ')
  const password = flag(args, 'password-stdin')
    ? await readStdin()
    : String(process.env.HODMAN_PASSWORD ?? '') || await promptHidden('Password: ')
  if (!password) throw new Error('password_required')
  const client = new HodmanApiClient(host)
  const result = await client.login(email || identifier.includes('@')
    ? { email: email ?? identifier, password }
    : { username: username ?? identifier, password })
  await setStoredSession(host, {
    refreshToken: result.refreshToken,
    accessToken: result.accessToken,
    accessTokenExpiresAt: jwtExpiresAt(result.accessToken),
    userLabel: identifier,
  })
  const authorized = new HodmanApiClient(host, async () => result.accessToken)
  const profile = await authorized.profile()
  const selected = profile.tenants.find((tenant) => tenant.current) ?? profile.tenants[0]
  await patchConfig({ host, tenant: selected?.name ?? null, projectId: null })
  return { ok: true, host, user: profile.user, tenant: selected?.name ?? null }
}

async function authStatus(): Promise<unknown> {
  const config = await readConfig()
  const resolved = await resolveSession(config.host)
  if (!resolved) return { ok: true, authenticated: false, host: config.host }
  const client = await authenticatedClient()
  const profile = await client.profile()
  return {
    ok: true,
    authenticated: true,
    host: config.host,
    tenant: config.tenant,
    projectId: config.projectId,
    credentialBackend: resolved.source,
    user: profile.user,
  }
}

async function logout(): Promise<unknown> {
  const config = await readConfig()
  const resolved = await resolveSession(config.host)
  if (resolved?.source === 'environment') {
    const client = new HodmanApiClient(config.host)
    await client.logout(resolved.session.refreshToken)
  } else if (resolved) {
    await withRefreshLock(config.host, async () => {
      const latest = await resolveSession(config.host)
      if (!latest || latest.source === 'environment') return
      const client = new HodmanApiClient(config.host)
      await client.logout(latest.session.refreshToken).catch(() => undefined)
      await deleteStoredSession(config.host)
    })
  }
  await patchConfig({ tenant: null, projectId: null })
  return { ok: true, host: config.host }
}

async function projectEnvRecord(client: HodmanApiClient, tenant: string, projectId: string, env: 'dev' | 'prod'): Promise<THodmanProjectEnv | null> {
  const response = await client.projectEnvs(tenant, projectId, env)
  return response.result[0] ?? null
}

function redactedEnv(record: THodmanProjectEnv | null): unknown {
  if (!record) return { env: null, values: {} }
  return {
    uuid: record.uuid,
    tenant: record.tenant,
    projectId: record.projectId,
    env: record.env,
    keys: Object.keys(record.values ?? {}).sort(),
    values: Object.fromEntries(Object.keys(record.values ?? {}).sort().map((key) => [key, '<secret>'])),
  }
}

function sanitizeGitConnection(connection: THodmanGitConnection): unknown {
  return {
    ...connection,
    password: connection.password ? '<secret>' : null,
    privateKey: connection.privateKey ? '<secret>' : null,
    hasPassword: Boolean(connection.password),
    hasPrivateKey: Boolean(connection.privateKey),
  }
}

async function waitForThread(client: HodmanApiClient, tenant: string, threadId: string, afterMessageId: string, timeoutSeconds: number): Promise<unknown> {
  const deadline = Date.now() + Math.max(1, Math.min(timeoutSeconds, 3600)) * 1000
  while (Date.now() < deadline) {
    const [thread, messages] = await Promise.all([
      client.thread(tenant, threadId),
      client.messages(tenant, threadId, 300, 0),
    ])
    const index = messages.result.findIndex((message) => message.uuid === afterMessageId)
    const newer = index >= 0 ? messages.result.slice(index + 1) : messages.result
    if (newer.some((message) => message.role === 'assistant' || message.role === 'error') && thread.runStatus !== 'running') {
      return { thread, messages: newer }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('thread_wait_timeout')
}

async function createTask(client: HodmanApiClient, args: ParsedArgs): Promise<unknown> {
  const { tenant, projectId } = await projectContext(args)
  const title = requiredOption(args, 'title')
  const message = requiredOption(args, 'message')
  const status = resolveTaskStatus(args)
  const thread = await client.createThread(tenant, {
    tenant,
    projectId,
    boardProjectId: projectId,
    assigneeProjectId: projectId,
    name: title,
    threadStatus: status,
    taskMode: 'work',
    priorityRank: option(args, 'priority') ? numberOption(args, 'priority', 0) : null,
  })
  const created = await client.createMessage(tenant, {
    tenant,
    threadId: thread.uuid,
    role: 'user',
    textContent: message,
    llmProvider: 'dzun-api',
  })
  if (flag(args, 'wait')) {
    return waitForThread(client, tenant, thread.uuid, created.uuid, numberOption(args, 'timeout', 300))
  }
  return { task: thread, message: created }
}

export async function runCommand(args: ParsedArgs): Promise<unknown> {
  const scope = args.positionals[0]
  const action = args.positionals[1]
  if (!scope || scope === 'help' || flag(args, 'help')) usage()
  if (scope === 'version') return { version: CLI_VERSION }

  if (scope === 'auth' && action === 'login') return login(args)
  if (scope === 'auth' && action === 'status') return authStatus()
  if (scope === 'auth' && action === 'logout') return logout()

  if (scope === 'host' && action === 'show') return { host: (await readConfig()).host }
  if (scope === 'host' && action === 'set') {
    const host = normalizeHost(positional(args, 2, 'host_required'))
    return patchConfig({ host, tenant: null, projectId: null })
  }

  const client = await authenticatedClient()

  if (scope === 'tenant' && action === 'list') {
    return client.tenants(
      numberOption(args, 'limit', 20),
      numberOption(args, 'offset', 0),
      option(args, 'search') ?? undefined,
    )
  }
  if (scope === 'tenant' && action === 'current') {
    const config = await readConfig()
    return { tenant: config.tenant }
  }
  if (scope === 'tenant' && action === 'use') {
    const name = positional(args, 2, 'tenant_required')
    const tenant = await client.tenantByName(name)
    if (!tenant) throw new Error('tenant_not_accessible')
    return patchConfig({ tenant: tenant.name, projectId: null })
  }

  if (scope === 'project' && action === 'current') {
    const config = await readConfig()
    return { tenant: config.tenant, projectId: config.projectId }
  }
  if (scope === 'project' && action === 'list') {
    const { tenant } = await context(args)
    return client.projects(tenant, numberOption(args, 'limit', 100), numberOption(args, 'offset', 0))
  }
  if (scope === 'project' && action === 'use') {
    const projectId = positional(args, 2, 'project_required')
    const { tenant } = await context(args)
    const project = await client.project(tenant, projectId)
    await patchConfig({ tenant, projectId: project.uuid })
    return { ok: true, project }
  }
  if (scope === 'project' && action === 'show') {
    const { tenant, projectId } = await projectContext(args)
    return client.project(tenant, projectId)
  }
  if (scope === 'project' && action === 'create') {
    const { tenant } = await context(args)
    const prompt = await readTextInput({ value: option(args, 'prompt'), file: option(args, 'prompt-file'), stdin: flag(args, 'stdin') })
    const creationPolicy = resolveProjectCreationPolicy(args, prompt)
    const ownership = resolveProjectOwnership(args)
    return client.provisionProject(tenant, {
      slug: requiredOption(args, 'slug'),
      ...creationPolicy,
      ...(prompt ? { prompt } : {}),
      ...ownership,
      deferInitialRun: flag(args, 'defer-run'),
    })
  }
  if (scope === 'project' && action === 'create-subproject') {
    const { tenant, projectId: parentProjectId } = await projectContext(args)
    const prompt = await readTextInput({ value: option(args, 'prompt'), file: option(args, 'prompt-file'), stdin: flag(args, 'stdin') })
    if (!prompt.trim()) throw new Error('prompt_required')
    const projectType = option(args, 'type') ?? 'web-app'
    if (projectType !== 'web-app' && projectType !== 'landing-page' && projectType !== 'prompt') {
      throw new Error('invalid_subproject_type')
    }
    const projectIntent = option(args, 'intent')
    return client.provisionSubProject(tenant, parentProjectId, {
      pathname: requiredOption(args, 'pathname'),
      projectType,
      ...(projectIntent ? { projectIntent } : {}),
      prompt,
      deferInitialRun: flag(args, 'defer-run'),
    })
  }
  if (scope === 'project' && action === 'update') {
    const { tenant, projectId } = await projectContext(args)
    const patch = parseSetOptions(args)
    if (Object.keys(patch).length === 0) throw new Error('at_least_one_set_required')
    return client.patchProject(tenant, projectId, patch)
  }
  if (scope === 'project' && ['run', 'build', 'stop'].includes(action ?? '')) {
    const { tenant, projectId } = await projectContext(args)
    return client.projectOperation(tenant, projectId, action as 'run' | 'build' | 'stop')
  }
  if (scope === 'project' && action === 'publish') {
    const { tenant, projectId } = await projectContext(args)
    return client.publishProject(tenant, projectId)
  }
  if (scope === 'project' && action === 'publish-status') {
    const { tenant, projectId } = await projectContext(args)
    return client.publishStatus(tenant, projectId)
  }
  if (scope === 'project' && action === 'releases') {
    const { tenant, projectId } = await projectContext(args)
    return client.releases(tenant, projectId, numberOption(args, 'limit', 50), numberOption(args, 'offset', 0))
  }
  if (scope === 'project' && action === 'release') {
    const { tenant } = await context(args)
    return client.release(tenant, requiredOption(args, 'release'))
  }

  if (scope === 'task' && action === 'list') {
    const { tenant, projectId } = await projectContext(args)
    const response = await client.threads(tenant, projectId, numberOption(args, 'limit', 200), numberOption(args, 'offset', 0))
    const status = option(args, 'status')
    return { ...response, result: status ? response.result.filter((thread) => thread.threadStatus === status) : response.result }
  }
  if (scope === 'task' && action === 'show') {
    const { tenant } = await context(args)
    const taskId = requiredOption(args, 'task')
    const [task, messages] = await Promise.all([client.thread(tenant, taskId), client.messages(tenant, taskId)])
    return { task, messages: messages.result }
  }
  if (scope === 'task' && action === 'create') return createTask(client, args)
  if (scope === 'task' && action === 'move') {
    const { tenant } = await context(args)
    const taskId = requiredOption(args, 'task')
    return client.executeTaskTool(tenant, taskId, 'move_task', {
      taskId,
      status: requiredOption(args, 'status'),
    })
  }
  if (scope === 'task' && (action === 'reply' || action === 'complete')) {
    const { tenant } = await context(args)
    const taskId = requiredOption(args, 'task')
    const message = requiredOption(args, 'message')
    return action === 'complete'
      ? client.executeTaskTool(tenant, taskId, 'complete_task', { taskId, resultSummary: message })
      : client.executeTaskTool(tenant, taskId, 'reply_to_task', { taskId, answer: message, complete: false })
  }

  if (scope === 'thread' && action === 'messages') {
    const { tenant } = await context(args)
    return client.messages(tenant, requiredOption(args, 'thread'), numberOption(args, 'limit', 300), numberOption(args, 'offset', 0))
  }
  if (scope === 'thread' && action === 'send') {
    const { tenant } = await context(args)
    const threadId = requiredOption(args, 'thread')
    const message = await client.createMessage(tenant, {
      tenant,
      threadId,
      role: 'user',
      textContent: requiredOption(args, 'message'),
      llmProvider: 'dzun-api',
    })
    return flag(args, 'wait')
      ? waitForThread(client, tenant, threadId, message.uuid, numberOption(args, 'timeout', 300))
      : message
  }

  if (scope === 'messengers' && action === 'telegram') {
    const operation = args.positionals[2]
    const leafAction = args.positionals[3]
    const { tenant, projectId } = await projectContext(args)
    if (operation === 'status') return client.telegramStatus(tenant, projectId)
    if (operation === 'connect') return client.telegramConnect(tenant, projectId, requiredOption(args, 'token'))
    if (operation === 'disconnect') return client.telegramDisconnect(tenant, projectId)
    if (operation === 'refresh') return client.telegramRefresh(tenant, projectId)
    if (operation === 'chats' && leafAction === 'list') {
      const status = await client.telegramStatus(tenant, projectId)
      return { result: status.allowedChats, total: status.allowedChats.length }
    }
    if (operation === 'chats' && leafAction === 'add') {
      return client.telegramAddChat(tenant, projectId, requiredOption(args, 'chat'))
    }
    if (operation === 'chats' && leafAction === 'remove') {
      return client.telegramRemoveChat(tenant, projectId, requiredOption(args, 'chat'))
    }
    if (operation === 'requests' && leafAction === 'list') {
      const status = option(args, 'status')
      if (status && status !== 'pending' && status !== 'history' && status !== 'all') throw new Error('invalid_telegram_request_status')
      return client.telegramRequests(tenant, projectId, {
        status: status as 'pending' | 'history' | 'all' | undefined,
        search: option(args, 'search') ?? undefined,
        limit: numberOption(args, 'limit', 20),
        offset: numberOption(args, 'offset', 0),
      })
    }
    if (operation === 'requests' && (leafAction === 'approve' || leafAction === 'reject')) {
      return client.telegramDecideRequest(tenant, projectId, requiredOption(args, 'request'), leafAction === 'approve' ? 'approve' : 'reject')
    }
    if (operation === 'send') {
      return client.telegramSend(tenant, projectId, requiredOption(args, 'chat'), requiredOption(args, 'message'))
    }
  }

  if (scope === 'connectors') {
    const { tenant } = await context(args)
    if (action === 'list') return client.appConnections(tenant)
    if (action === 'probe') return client.probeAppConnection(tenant, requiredOption(args, 'target'))
    if (action === 'create') return client.createAppConnection(tenant, requiredOption(args, 'target'))
    if (action === 'delete') return client.deleteAppConnection(tenant, requiredOption(args, 'target'))
    if (action === 'grants' && args.positionals[2] === 'set') {
      const parsed: unknown = JSON.parse(requiredOption(args, 'sources-json'))
      if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) throw new Error('sources_json_must_be_string_array')
      return client.setAppConnectionGrants(tenant, requiredOption(args, 'target'), parsed)
    }
  }

  if (scope === 'env') {
    const { tenant, projectId } = await projectContext(args)
    const env = environment(args)
    const record = await projectEnvRecord(client, tenant, projectId, env)
    if (action === 'list') return redactedEnv(record)
    const key = positional(args, 2, 'env_key_required')
    if (action === 'get') {
      if (!flag(args, 'unsafe')) throw new Error('unsafe_flag_required_to_reveal_secret')
      if (!record || !(key in (record.values ?? {}))) throw new Error('env_key_not_found')
      return { projectId, env, key, value: record.values?.[key] }
    }
    if (action === 'set') {
      const value = positional(args, 3, 'env_value_required')
      const values = { ...(record?.values ?? {}), [key]: value }
      return record
        ? client.patchProjectEnv(tenant, record.uuid, { values })
        : client.createProjectEnv(tenant, { tenant, projectId, env, values })
    }
    if (action === 'unset') {
      if (!record) return { ok: true, removed: false }
      const values = { ...(record.values ?? {}) }
      const removed = key in values
      delete values[key]
      await client.patchProjectEnv(tenant, record.uuid, { values })
      return { ok: true, removed, key }
    }
  }

  if (scope === 'file') {
    const { tenant, projectId } = await projectContext(args)
    if (action === 'tree') return client.fileTree(tenant, projectId)
    if (action === 'cat') return client.fileContent(tenant, projectId, requiredOption(args, 'path'))
    if (action === 'get') {
      const remotePath = requiredOption(args, 'path')
      const outputPath = requiredOption(args, 'output')
      const content = await client.fileContent(tenant, projectId, remotePath)
      const bytes = content.isBinary
        ? Buffer.from(content.base64Content ?? '', 'base64')
        : Buffer.from(content.content, 'utf8')
      await fs.writeFile(outputPath, bytes)
      return { ok: true, path: remotePath, output: outputPath, bytes: bytes.length }
    }
    if (action === 'mkdir') return client.mkdir(tenant, { projectId, path: requiredOption(args, 'path') })
    if (action === 'put') {
      const remotePath = requiredOption(args, 'path')
      const localPath = requiredOption(args, 'local')
      const bytes = await fs.readFile(localPath)
      if (bytes.includes(0)) throw new Error('binary_put_not_supported_in_mvp')
      const connectionId = `cli.${crypto.randomUUID()}`
      let locked = false
      try {
        await client.lockProject(tenant, projectId, connectionId)
        locked = true
        await client.saveFile(tenant, { projectId, path: remotePath, content: bytes.toString('utf8') })
      } finally {
        if (locked) await client.unlockProject(tenant, projectId, connectionId).catch(() => undefined)
      }
      return { ok: true, path: remotePath, local: localPath, bytes: bytes.length }
    }
  }

  if (scope === 'shell' && action === 'exec') {
    const { tenant, projectId } = await projectContext(args)
    const command = option(args, 'command') ?? args.positionals.slice(2).join(' ')
    if (!command) throw new Error('command_required')
    return client.shell(tenant, { projectId, command, env: environment(args), timeoutMs: numberOption(args, 'timeout', 300) * 1000 })
  }
  if (scope === 'sql' && action === 'query') {
    const { tenant, projectId } = await projectContext(args)
    const query = await readTextInput({ value: option(args, 'query'), file: option(args, 'file'), stdin: flag(args, 'stdin') })
    if (!query.trim()) throw new Error('query_required')
    return client.sql(tenant, { projectId, query, env: environment(args) })
  }
  if (scope === 'logs') {
    const { tenant, projectId } = await projectContext(args)
    return client.logs(tenant, projectId, environment(args), numberOption(args, 'limit', 20))
  }

  if (scope === 'git' && action === 'list') {
    const { tenant, projectId } = await projectContext(args)
    const response = await client.gitConnections(tenant, projectId)
    return { ...response, result: response.result.map(sanitizeGitConnection) }
  }
  if (scope === 'git' && action === 'show') {
    const { tenant } = await context(args)
    return sanitizeGitConnection(await client.gitConnection(tenant, requiredOption(args, 'connection')))
  }
  if (scope === 'git' && action === 'secret') {
    if (!flag(args, 'unsafe')) throw new Error('unsafe_flag_required_to_reveal_secret')
    const { tenant } = await context(args)
    const field = requiredOption(args, 'field')
    if (field !== 'password' && field !== 'privateKey') throw new Error('invalid_secret_field')
    const connection = await client.gitConnection(tenant, requiredOption(args, 'connection'))
    return { connectionId: connection.uuid, field, value: connection[field] ?? null }
  }
  if (scope === 'git' && action === 'add') {
    const { tenant, projectId } = await projectContext(args)
    const authorizationType = requiredOption(args, 'type')
    if (authorizationType !== 'credentials' && authorizationType !== 'ssh-key') throw new Error('invalid_git_connection_type')
    const password = authorizationType === 'credentials'
      ? (flag(args, 'password-stdin') ? await readStdin() : await promptHidden('Git password or token: '))
      : null
    const privateKey = authorizationType === 'ssh-key'
      ? await fs.readFile(requiredOption(args, 'private-key-file'), 'utf8')
      : null
    return client.createGitConnection(tenant, {
      tenant,
      projectId,
      host: requiredOption(args, 'host'),
      authorizationType,
      login: option(args, 'login'),
      password,
      privateKey,
      provider: 'manual',
    })
  }
  if (scope === 'git' && action === 'remove') {
    const { tenant } = await context(args)
    return client.deleteGitConnection(tenant, requiredOption(args, 'connection'))
  }

  if (scope === 'github' && action === 'connect') {
    const { tenant, projectId } = await context(args)
    return client.githubStart(tenant, { ...(projectId ? { projectId } : {}) })
  }
  if (scope === 'github' && action === 'repos') {
    const { tenant } = await context(args)
    return client.githubRepositories(tenant, option(args, 'connection') ?? undefined)
  }

  usage()
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv)
  try {
    print(await runCommand(args))
  } catch (error: unknown) {
    const code = error instanceof HodmanApiError ? error.code : error instanceof Error ? error.message : String(error)
    const payload: JsonObject = { err: code }
    if (error instanceof HodmanApiError) {
      payload.status = error.status
      if (error.description) payload.errDescription = error.description
    }
    process.stderr.write(`${JSON.stringify(payload)}\n`)
    process.exitCode = 1
  }
}

if (process.env.HODMAN_CLI_NO_AUTO_RUN !== '1') {
  void main()
}
