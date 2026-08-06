export type ParsedArgs = {
  positionals: string[]
  options: Map<string, string[]>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const options = new Map<string, string[]>()
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index] ?? ''
    if (!value.startsWith('--')) {
      positionals.push(value)
      continue
    }
    const equal = value.indexOf('=')
    const key = value.slice(2, equal > 2 ? equal : undefined)
    let optionValue = equal > 2 ? value.slice(equal + 1) : 'true'
    const next = argv[index + 1]
    if (equal < 0 && next && !next.startsWith('--')) {
      optionValue = next
      index++
    }
    options.set(key, [...(options.get(key) ?? []), optionValue])
  }
  return { positionals, options }
}

export function option(args: ParsedArgs, name: string): string | null {
  return args.options.get(name)?.at(-1) ?? null
}

export function optionAll(args: ParsedArgs, name: string): string[] {
  return args.options.get(name) ?? []
}

export function flag(args: ParsedArgs, name: string): boolean {
  const value = option(args, name)
  return value !== null && value !== 'false' && value !== '0'
}

export function requiredOption(args: ParsedArgs, name: string): string {
  const value = option(args, name)
  if (!value || value === 'true') throw new Error(`${name}_required`)
  return value
}

export function numberOption(args: ParsedArgs, name: string, fallback: number): number {
  const value = option(args, name)
  if (value == null) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`invalid_${name}`)
  return parsed
}

export function parseValue(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return JSON.parse(trimmed)
  }
  return value
}

export function parseSetOptions(args: ParsedArgs): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const entry of optionAll(args, 'set')) {
    const separator = entry.indexOf('=')
    if (separator <= 0) throw new Error('set_must_be_key_value')
    result[entry.slice(0, separator)] = parseValue(entry.slice(separator + 1))
  }
  return result
}
