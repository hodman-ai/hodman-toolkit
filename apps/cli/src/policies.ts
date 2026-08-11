import { option, type ParsedArgs } from './args.js'

export function resolveTaskStatus(args: ParsedArgs): 'backlog' | 'todo' {
  const status = option(args, 'status') ?? 'backlog'
  if (status !== 'backlog' && status !== 'todo') throw new Error('invalid_task_status')
  return status
}

export function resolveProjectCreationPolicy(
  args: ParsedArgs,
  prompt: string,
): { projectType: 'custom' | 'prompt'; projectIntent?: 'aiAgent' } {
  const mode = option(args, 'mode')
  if (mode && mode !== 'builder' && mode !== 'agent') throw new Error('invalid_project_mode')

  const requestedType = option(args, 'type')
  if (requestedType && requestedType !== 'prompt' && requestedType !== 'custom') {
    throw new Error('invalid_project_type')
  }
  const projectType: 'custom' | 'prompt' = requestedType === 'prompt' || requestedType === 'custom'
    ? requestedType
    : prompt || mode === 'agent'
      ? 'prompt'
      : 'custom'

  return {
    projectType,
    ...(mode === 'agent' ? { projectIntent: 'aiAgent' as const } : {}),
  }
}
