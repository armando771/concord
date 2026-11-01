// Funções de arquivos TS/TSX com complexidade ciclomática (compiler API do
// `typescript` do frontend) e cobertura vinda do coverage-final.json (istanbul).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ROOT } from './run.mjs'

const require = createRequire(path.join(ROOT, 'frontend/package.json'))
const ts = require('typescript')

const K = ts.SyntaxKind
const BRANCHES = new Set([
  K.IfStatement, K.ForStatement, K.ForInStatement, K.ForOfStatement, K.WhileStatement,
  K.DoStatement, K.CaseClause, K.CatchClause, K.ConditionalExpression
])
const LOGICAL = new Set([K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken])

const isFunction = (node) =>
  ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node) || ts.isConstructorDeclaration(node) || ts.isAccessor(node)

const isBranch = (node) =>
  BRANCHES.has(node.kind) || (ts.isBinaryExpression(node) && LOGICAL.has(node.operatorToken.kind))

// complexity conta 1 + desvios do corpo, sem entrar em funções aninhadas
// (cada uma é medida por si, como no ESLint).
export function complexity(fn) {
  let total = 1
  const visit = (node) => {
    if (isFunction(node)) return
    if (isBranch(node)) total++
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(fn, visit)
  return total
}

// functionName: nome declarado, ou o da variável/propriedade que recebe a arrow.
function functionName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text
  if (ts.isConstructorDeclaration(node)) return 'constructor'
  const parent = node.parent
  const named = parent && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent))
  return named && parent.name && ts.isIdentifier(parent.name) ? parent.name.text : '<anônima>'
}

// parseSource lista as funções de um código-fonte com início/fim (linhas 1-based).
export function parseSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const line = (pos) => source.getLineAndCharacterOfPosition(pos).line + 1
  const fns = []
  const visit = (node) => {
    if (isFunction(node) && node.body) {
      fns.push({ file, name: functionName(node), start: line(node.getStart()), end: line(node.end), complexity: complexity(node), coverage: 0 })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return fns
}

// coverageOf: fração dos statements do istanbul (de um arquivo) que caem no
// intervalo da função e rodaram.
export function coverageOf(fn, fileCoverage) {
  if (!fileCoverage) return 0
  let total = 0
  let covered = 0
  for (const [id, loc] of Object.entries(fileCoverage.statementMap)) {
    if (loc.start.line < fn.start || loc.start.line > fn.end) continue
    total++
    if (fileCoverage.s[id] > 0) covered++
  }
  return total === 0 ? 0 : covered / total
}

// tsFunctions mede os arquivos (caminhos relativos à raiz do repo) usando o
// coverage-final.json do vitest, cujas chaves são caminhos absolutos.
export function tsFunctions(files, coverageJson = {}) {
  const byPath = Object.fromEntries(Object.entries(coverageJson).map(([k, v]) => [path.resolve(k).toLowerCase(), v]))
  return files.flatMap((file) => {
    const fileCoverage = byPath[path.resolve(file).toLowerCase()]
    return parseSource(file, readFileSync(file, 'utf8')).map((fn) => ({ ...fn, coverage: coverageOf(fn, fileCoverage) }))
  })
}
