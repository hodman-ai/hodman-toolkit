import { describe, expect, it } from 'vitest'

import { parseArgs } from './args.js'
import { resolveProjectCreationPolicy, resolveProjectOwnership, resolveTaskStatus } from './policies.js'

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

  it('assigns a requested active tenant user as the personal project owner', () => {
    const args = parseArgs(['project', 'create', '--owner-user', 'user-123'])
    expect(resolveProjectOwnership(args)).toEqual({
      visibility: 'personal',
      ownerUserId: 'user-123',
    })
  })

  it('keeps the existing visibility behavior when no owner is specified', () => {
    expect(resolveProjectOwnership(parseArgs(['project', 'create']))).toEqual({ visibility: 'personal' })
    expect(resolveProjectOwnership(parseArgs(['project', 'create', '--visibility', 'tenant']))).toEqual({ visibility: 'tenant' })
  })

  it('requires a value for the owner option', () => {
    const args = parseArgs(['project', 'create', '--owner-user'])
    expect(() => resolveProjectOwnership(args)).toThrow('owner-user_required')
  })

  it('does not allow the external CLI to create Inbox tasks', () => {
    const args = parseArgs(['task', 'create', '--status', 'inbox'])
    expect(() => resolveTaskStatus(args)).toThrow('invalid_task_status')
  })
})
