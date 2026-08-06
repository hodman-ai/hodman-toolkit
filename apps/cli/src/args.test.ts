import { describe, expect, it } from 'vitest'

import { flag, option, optionAll, parseArgs, parseSetOptions } from './args.js'

describe('CLI arguments', () => {
  it('parses repeated values, equals syntax, and flags', () => {
    const args = parseArgs(['project', 'update', '--set', 'port=3000', '--set=runCmd=npm start', '--unsafe'])
    expect(args.positionals).toEqual(['project', 'update'])
    expect(optionAll(args, 'set')).toEqual(['port=3000', 'runCmd=npm start'])
    expect(flag(args, 'unsafe')).toBe(true)
    expect(option(args, 'missing')).toBeNull()
    expect(parseSetOptions(args)).toEqual({ port: 3000, runCmd: 'npm start' })
  })
})
