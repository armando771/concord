// Publica as notas da release no changelog do app.
//
//   CHANGELOG_TOKEN=… node scripts/publish-changelog.mjs <versão> <notas.md> <url-base>
//   node scripts/publish-changelog.mjs --check <notas.md>
//
// Lê `changelog/next.md` (seções "## Novidades" e "## Correções" em bullets),
// faz o PUT idempotente em <url-base>/api/changelog/<versão> e, só se deu
// certo, deixa o arquivo vazio para a próxima release.
import { readFileSync, writeFileSync } from 'node:fs'

export const EMPTY_NOTES = '## Novidades\n\n## Correções\n'

// Mesmos limites de backend/internal/changelog/changelog.go: o erro aparece
// aqui, antes do merge, e não no PUT depois que a versão já está no ar.
export const MAX_ENTRIES = 100
export const MAX_ENTRY_TEXT = 1000

const SECTIONS = { novidades: 'feature', correções: 'fix', correcoes: 'fix' }

export function parseNotes(markdown) {
  const entries = []
  let kind = null
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const heading = /^##\s+(.+)$/.exec(line)
    if (heading) {
      kind = SECTIONS[heading[1].trim().toLowerCase()]
      if (!kind) throw new Error(`seção desconhecida: ${heading[1].trim()}`)
      continue
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (!bullet) continue
    if (!kind) throw new Error(`bullet fora de uma seção: ${line}`)
    entries.push({ kind, text: bullet[1].trim() })
  }
  checkLimits(entries)
  return { entries }
}

// Conta caracteres (code points), como o utf8.RuneCountInString do servidor.
function checkLimits(entries) {
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`entradas demais: ${entries.length} (máximo ${MAX_ENTRIES})`)
  }
  for (const { text } of entries) {
    const size = [...text].length
    if (size > MAX_ENTRY_TEXT) {
      throw new Error(`nota com ${size} caracteres (máximo ${MAX_ENTRY_TEXT}): ${text.slice(0, 60)}…`)
    }
  }
}

export async function publishError(version, res) {
  const body = (await res.text().catch(() => '')).trim()
  return `PUT /api/changelog/${version}: HTTP ${res.status}${body ? ` ${body}` : ''}`
}

// --check <notas.md>: só valida (o affected-tests pr chama quando o diff toca o arquivo).
function check(file) {
  const { entries } = parseNotes(readFileSync(file, 'utf8'))
  console.log(`${file}: ${entries.length} entradas dentro dos limites`)
}

async function main([version, file, baseUrl]) {
  if (version === '--check') return check(file)
  const token = process.env.CHANGELOG_TOKEN
  if (!version || !file || !baseUrl || !token) {
    throw new Error('uso: CHANGELOG_TOKEN=… publish-changelog.mjs <versão> <notas.md> <url-base>')
  }
  const { entries } = parseNotes(readFileSync(file, 'utf8'))
  if (entries.length === 0) console.warn(`::warning::changelog/next.md vazio: ${version} sai sem notas`)
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/changelog/${version}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Changelog-Token': token },
    body: JSON.stringify({ entries })
  })
  if (!res.ok) throw new Error(await publishError(version, res))
  writeFileSync(file, EMPTY_NOTES)
  console.log(`changelog ${version}: ${entries.length} entradas publicadas`)
}

if (process.argv[1]?.endsWith('publish-changelog.mjs')) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
