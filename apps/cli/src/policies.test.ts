import { describe, expect, it } from 'vitest'

import { parseArgs } from './args.js'
import { resolveProjectCreationPolicy, resolveTaskStatus } from './policies.js'

describe('public CLI policies', () => {
  it('passes the AI-agent project intent through to the platform', () => {
    const args = parseArgs(['project', 'create', '--intent', 'aiAgent'])
    expect(resolveProjectCreationPolicy(args, 'Monitor campaigns')).toEqual({
      projectType: 'prompt',
      projectIntent: 'aiAgent',
    })
  })

  it('passes builder project intents through without inventing a mode field', () => {
    const args = parseArgs(['project', 'create', '--intent', 'webApplication'])
    expect(resolveProjectCreationPolicy(args, 'Build an application')).toEqual({
      projectType: 'prompt',
      projectIntent: 'webApplication',
    })
  })

  it('does not allow the external CLI to create Inbox tasks', () => {
    const args = parseArgs(['task', 'create', '--status', 'inbox'])
    expect(() => resolveTaskStatus(args)).toThrow('invalid_task_status')
  })
})
