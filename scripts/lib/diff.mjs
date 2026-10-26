// O que mudou em relação a uma base do git: arquivos e linhas alteradas
// (commits do branch + working tree + arquivos novos não rastreados).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 })

// parseDiff lê a saída de `git diff -U0` e devolve { arquivo: [[início, fim], ...] }
// com as linhas do lado novo. Arquivo apagado não entra.
export function parseDiff(text) {
  const changes = {}
  let file = null
  for (const line of text.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? null : line.slice(6)
      if (file) changes[file] ??= []
      continue
    }
    const hunk = file && /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!hunk) continue
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    if (count > 0) changes[file].push([start, start + count - 1])
  }
  return changes
}

// defaultBase: origin/develop se existir (fluxo do repo), senão origin/main.
export function defaultBase() {
  for (const ref of ['origin/develop', 'origin/main']) {
    try {
      git(['rev-parse', '--verify', '--quiet', ref])
      return ref
    } catch {
      // tenta a próxima
    }
  }
  return 'HEAD'
}

// changedLines devolve as linhas alteradas desde o merge-base com `base`. Arquivo
// só movido (rename sem mudança) não aparece: mover não é tocar no código.
export function changedLines(base = defaultBase()) {
  const mergeBase = git(['merge-base', base, 'HEAD']).trim()
  const changes = parseDiff(git(['diff', '-U0', '--no-color', '-M30%', mergeBase]))
  for (const file of git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)) {
    const lines = readFileSync(file, 'utf8').split('\n').length
    changes[file] = [[1, lines]]
  }
  return changes
}

// renames devolve { caminhoNovo: caminhoAntigo } dos arquivos movidos desde a base.
export function renames(base = defaultBase()) {
  const mergeBase = git(['merge-base', base, 'HEAD']).trim()
  const map = {}
  for (const line of git(['diff', '-M30%', '--name-status', mergeBase]).split('\n')) {
    const [status, from, to] = line.split('\t')
    if (status?.startsWith('R')) map[to] = from
  }
  return map
}

// Linha que não muda comportamento: em branco, comentário ou import (TS e Go).
const TRIVIAL = [
  /^\s*$/,
  /^\s*(\/\/|\/\*|\*)/,
  /^\s*import\b.*$/,
  /^\s*(export\s+(\*|\{[^}]*\})\s+)?from\s+['"][^'"]+['"];?\s*$/,
  /^\s*\}?\s*from\s+['"][^'"]+['"];?\s*$/,
  /^\s*(\w+\s+|\.\s+|_\s+)?"[^"]+"\s*$/
]
export const isTrivialLine = (line) => TRIVIAL.some((re) => re.test(line))

// codeChanges mantém só as linhas alteradas que são código (tira imports,
// comentários e linhas em branco). Arquivo sem nenhuma linha de código sai.
export function codeChanges(changes, read = (file) => readFileSync(file, 'utf8')) {
  const result = {}
  for (const [file, ranges] of Object.entries(changes)) {
    let text
    try {
      text = read(file).split(/\r?\n/)
    } catch {
      continue
    }
    const kept = []
    for (const [start, end] of ranges) {
      for (let n = start; n <= end; n++) if (!isTrivialLine(text[n - 1] ?? '')) kept.push([n, n])
    }
    if (kept.length) result[file] = kept
  }
  return result
}
