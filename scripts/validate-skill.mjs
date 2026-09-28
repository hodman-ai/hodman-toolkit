import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const skill = fileURLToPath(new URL('../skills/hodman/SKILL.md', import.meta.url))
const license = fileURLToPath(new URL('../skills/hodman/LICENSE', import.meta.url))
const text = readFileSync(skill, 'utf8')
const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)
assert.ok(frontmatter, 'SKILL.md must have YAML frontmatter')
const header = frontmatter[1]
for (const key of ['name: hodman', 'description:', 'license: MIT-0', 'compatibility:', 'metadata:']) {
  assert.ok(header.includes(key), `missing ${key}`)
}
assert.ok(readFileSync(license, 'utf8').startsWith('MIT No Attribution'))
assert.ok(!text.includes('~/.cargo/bin/hodman') || text.includes('Never guess `~/.cargo/bin/hodman`'))
assert.ok(text.includes('npx skills add') === false || readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8').includes('npx skills add hodman-ai/hodman-toolkit --skill hodman'))
console.log('Skill metadata, scoped license, and direct-GitHub install reference validated')
