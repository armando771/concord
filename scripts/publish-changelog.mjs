// Publica as notas da release no changelog do app.
//
//   CHANGELOG_TOKEN=… node scripts/publish-changelog.mjs <versão> <notas.md> <url-base>
//
// Lê `changelog/next.md` (seções "## Novidades" e "## Correções" em bullets),
// faz o PUT idempotente em <url-base>/api/changelog/<versão> e, só se deu
// certo, deixa o arquivo vazio para a próxima release.
import { readFileSync, writeFileSync } from 'node:fs'

export const EMPTY_NOTES = '## Novidades\n\n## Correções\n'

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
  return { entries }
}

async function main([version, file, baseUrl]) {
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
  if (!res.ok) throw new Error(`PUT /api/changelog/${version}: HTTP ${res.status}`)
  writeFileSync(file, EMPTY_NOTES)
  console.log(`changelog ${version}: ${entries.length} entradas publicadas`)
}

if (process.argv[1]?.endsWith('publish-changelog.mjs')) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
