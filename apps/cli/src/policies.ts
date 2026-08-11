import { option, type ParsedArgs } from './args.js'

export function resolveTaskStatus(args: ParsedArgs): 'backlog' | 'todo' {
  const status = option(args, 'status') ?? 'backlog'
  if (status !== 'backlog' && status !== 'todo') throw new Error('invalid_task_status')
  return status
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
