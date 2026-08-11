import { describe, expect, it } from 'vitest'

import { parseArgs } from './args.js'
import { resolveProjectCreationPolicy, resolveTaskStatus } from './policies.js'

describe('public CLI policies', () => {
  it('maps agent projects to the AI-agent platform intent', () => {
    const args = parseArgs(['project', 'create', '--mode', 'agent'])
    expect(resolveProjectCreationPolicy(args, 'Monitor campaigns')).toEqual({
      projectType: 'prompt',
      projectIntent: 'aiAgent',
    })
  })

  it('keeps builder projects on builder instructions', () => {
    const args = parseArgs(['project', 'create', '--mode', 'builder'])
    expect(resolveProjectCreationPolicy(args, 'Build an application')).toEqual({
      projectType: 'prompt',
    })
  })

  it('does not allow the external CLI to create Inbox tasks', () => {
    const args = parseArgs(['task', 'create', '--status', 'inbox'])
    expect(() => resolveTaskStatus(args)).toThrow('invalid_task_status')
  })
})
