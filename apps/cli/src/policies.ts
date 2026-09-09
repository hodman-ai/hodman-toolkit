import { option, requiredOption, type ParsedArgs } from './args.js'

export function resolveTaskStatus(args: ParsedArgs): 'backlog' | 'todo' {
  const status = option(args, 'status') ?? 'backlog'
  if (status !== 'backlog' && status !== 'todo') throw new Error('invalid_task_status')
  return status
}

export function resolveProjectOwnership(args: ParsedArgs): {
  visibility: 'tenant' | 'personal'
  ownerUserId?: string
} {
  const ownerUserId = option(args, 'owner-user')
  if (ownerUserId !== null) {
    return {
      visibility: 'personal',
      ownerUserId: requiredOption(args, 'owner-user'),
    }
  }
  return {
    visibility: option(args, 'visibility') === 'tenant' ? 'tenant' : 'personal',
  }
}

export function resolveProjectCreationPolicy(
  args: ParsedArgs,
  prompt: string,
): { projectType: 'custom' | 'prompt'; projectIntent?: string } {
  const projectIntent = option(args, 'intent')
  const requestedType = option(args, 'type')
  if (requestedType && requestedType !== 'prompt' && requestedType !== 'custom') {
    throw new Error('invalid_project_type')
  }
  const projectType: 'custom' | 'prompt' = requestedType === 'prompt' || requestedType === 'custom'
    ? requestedType
    : prompt || projectIntent
      ? 'prompt'
      : 'custom'

  return {
    projectType,
    ...(projectIntent ? { projectIntent } : {}),
  }
}
