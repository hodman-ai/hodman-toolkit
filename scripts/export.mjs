// Run from a private monorepo checkout: node toolkit/scripts/export.mjs <new-output-directory>
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, lstatSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = process.argv[2] && path.resolve(process.argv[2])
if (!output || existsSync(output) || output.startsWith(`${repo}${path.sep}`)) {
  throw new Error('Pass a new output directory outside the private checkout')
}
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
if (git('status', '--porcelain', '--', 'toolkit')) throw new Error('Commit Toolkit changes before export')
const tree = git('rev-parse', 'HEAD:toolkit')
const archive = spawnSync('git', ['-C', repo, 'archive', '--format=tar', tree], { maxBuffer: 30 * 1024 * 1024 })
if (archive.status !== 0) throw new Error('git archive failed')
mkdirSync(output, { recursive: true })
try {
  const extracted = spawnSync('tar', ['-xf', '-', '-C', output], { input: archive.stdout })
  if (extracted.status !== 0) throw new Error('tar extraction failed')
  const entries = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const filename = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(filename)
      else {
        if (!entry.isFile() || lstatSync(filename).size > 2_000_000) throw new Error('Unexpected file type or size')
        const relative = path.relative(output, filename).split(path.sep).join('/')
        if (/(^|\/)(\.env(\.|$)|credentials\.json|id_rsa|id_ed25519|node_modules|dist)(\/|\.|$)/i.test(relative)) throw new Error(`Forbidden pathname: ${relative}`)
        const content = readFileSync(filename)
        if (content.includes(0)) throw new Error(`Binary file forbidden: ${relative}`)
        const text = content.toString('utf8')
        if (/(@dzun-ai\/|@jetstyle\/|registry\.dzun|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i.test(text)) throw new Error(`Private package/credential pattern: ${relative}`)
        entries.push(`${createHash('sha256').update(content).digest('hex')}  ${relative}`)
      }
    }
  }
  walk(output)
  const digest = createHash('sha256').update(entries.join('\n') + '\n').digest('hex')
  console.log(JSON.stringify({ tree, output, files: entries.length, inventorySha256: digest }))
} catch (err) {
  rmSync(output, { recursive: true, force: true })
  throw err
}
