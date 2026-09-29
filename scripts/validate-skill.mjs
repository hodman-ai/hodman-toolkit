import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const skill = fileURLToPath(new URL('../skills/hodman/SKILL.md', import.meta.url))
const license = fileURLToPath(new URL('../skills/hodman/LICENSE', import.meta.url))
const text = readFileSync(skill, 'utf8')
const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)
assert.ok(frontmatter, 'SKILL.md must have YAML frontmatter')
const header = frontmatter[1]
assert.deepEqual(header.split('\n').map((line) => line.split(':', 1)[0]), ['name', 'description'], 'frontmatter must contain exactly name and description')
assert.ok(header.includes('name: hodman'))
assert.ok(header.includes('description:'))
assert.ok(text.includes('version 1.2.0') && text.includes('under MIT-0'), 'skill version and license must appear in body')
assert.ok(text.includes('Node.js 20+') && text.includes('interactive terminal'), 'compatibility requirements must appear in body')
assert.ok(readFileSync(license, 'utf8').startsWith('MIT No Attribution'))
assert.ok(!text.includes('~/.cargo/bin/hodman') || text.includes('Never guess `~/.cargo/bin/hodman`'))
assert.ok(text.includes('npx skills add') === false || readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8').includes('npx skills add hodman-ai/hodman-toolkit --skill hodman'))
console.log('Skill metadata, scoped license, and direct-GitHub install reference validated')
