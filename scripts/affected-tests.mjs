// Pipeline de testes otimizada: roda só o que o diff afeta.
//
//   node scripts/affected-tests.mjs loop   # a cada ciclo TDD: testes afetados
//   node scripts/affected-tests.mjs pr     # antes do PR: afetados + vet/typecheck + estrutura + CRAP
//                                          # (vira `full` se tocou código compartilhado)
//   node scripts/affected-tests.mjs full   # suíte inteira + vet/typecheck + CRAP
//   opção: --base <ref> (padrão origin/develop, senão origin/main)
import path from 'node:path'
import { classify, dependents, goPackages, parseGoList, scriptTests } from './lib/affected.mjs'
import { changedLines, defaultBase } from './lib/diff.mjs'
import { capture, GO, ROOT, run } from './lib/run.mjs'

const backend = path.join(ROOT, 'backend')
const frontend = path.join(ROOT, 'frontend')
const GO_LIST = '{{.ImportPath}}|{{join .Imports ","}}|{{join .TestImports ","}}|{{join .XTestImports ","}}'

// goAffected: pacotes alterados + quem importa deles, no formato do go test.
function goAffected(goFiles) {
  if (!goFiles.length) return []
  const module = capture(GO, ['list', '-m'], backend).trim()
  const changed = goPackages(goFiles).map((p) => module + p.slice(1))
  return dependents(parseGoList(capture(GO, ['list', '-f', GO_LIST, './...'], backend)), changed)
}

function loop(files) {
  const { go, ts, scripts } = classify(files)
  const codes = []
  const pkgs = goAffected(go)
  if (pkgs.length) codes.push(run(GO, ['test', ...pkgs], backend))
  if (ts.length) codes.push(run('npx', ['vitest', 'related', '--run', '--passWithNoTests', ...ts.map((f) => f.slice('frontend/'.length))], frontend))
  const tests = scriptTests(scripts)
  if (tests.length) codes.push(run('node', ['--test', ...tests]))
  if (!codes.length) console.log('Nada a testar no diff.')
  return codes
}

function checks(files, base) {
  const { go, ts } = classify(files)
  const codes = []
  if (go.length) codes.push(run(GO, ['vet', ...goPackages(go)], backend))
  if (ts.length) codes.push(run('npm', ['run', 'typecheck'], frontend))
  codes.push(run('node', ['scripts/check-structure.mjs', '--base', base]))
  codes.push(run('node', ['scripts/crap.mjs', '--base', base]))
  return codes
}

function full() {
  return [
    run(GO, ['vet', './...'], backend),
    run(GO, ['test', './...'], backend),
    run('npm', ['run', 'typecheck'], frontend),
    run('npx', ['vitest', 'run'], frontend),
    run('node', ['--test', 'scripts/**/*.test.mjs'])
  ]
}

function main() {
  const args = process.argv.slice(2)
  const mode = args.find((a) => !a.startsWith('--') && a !== args[args.indexOf('--base') + 1]) ?? 'loop'
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : defaultBase()
  process.chdir(ROOT)
  const files = Object.keys(changedLines(base))
  const { shared } = classify(files)
  let codes
  if (mode === 'full' || (mode === 'pr' && shared)) {
    if (mode === 'pr') console.log('Diff toca código compartilhado: rodando a suíte inteira.')
    codes = [...full(), run('node', ['scripts/check-structure.mjs', '--base', base]), run('node', ['scripts/crap.mjs', '--base', base])]
  } else if (mode === 'pr') {
    codes = [...loop(files), ...checks(files, base)]
  } else {
    codes = loop(files)
  }
  const failed = codes.filter((c) => c !== 0).length
  console.log(failed ? `\n❌ ${failed} etapa(s) falharam.` : '\n✅ Tudo verde.')
  process.exit(failed ? 1 : 0)
}

main()
