// Confere a estrutura de pastas de todo o repo e a catraca anti-god nos
// arquivos tocados (docs/ai/arquitetura.md, docs/ai/exemplos/god-files.md).
//
//   node scripts/check-structure.mjs              # diff contra origin/develop (ou origin/main)
//   node scripts/check-structure.mjs --base HEAD~3
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { changedLines, codeChanges, defaultBase, renames } from './lib/diff.mjs'
import { ROOT } from './lib/run.mjs'
import { godError, structureError } from './lib/structure.mjs'

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })
const lines = (text) => text.split('\n').length

function linesAt(ref, file) {
  try {
    return lines(git(['show', `${ref}:${file}`]))
  } catch {
    return null // não existia na base
  }
}

function main() {
  const args = process.argv.slice(2)
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : defaultBase()
  process.chdir(ROOT)
  const errors = []
  for (const file of git(['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(Boolean)) {
    const reason = existsSync(file) && structureError(file)
    if (reason) errors.push(`${file}: ${reason}`)
  }
  const mergeBase = git(['merge-base', base, 'HEAD']).trim()
  const moved = renames(base)
  for (const file of Object.keys(codeChanges(changedLines(base)))) {
    if (!existsSync(path.join(ROOT, file))) continue
    const reason = godError(file, linesAt(mergeBase, moved[file] ?? file), lines(readFileSync(file, 'utf8')))
    if (reason) errors.push(`${file}: ${reason}`)
  }
  if (errors.length) {
    console.error(`❌ Estrutura: ${errors.length} problema(s)\n` + errors.map((e) => `  - ${e}`).join('\n'))
    process.exit(1)
  }
  console.log('✅ Estrutura de pastas e catraca anti-god ok.')
}

main()
