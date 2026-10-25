// Confere os números das migrations (backend/migrations) antes do merge:
//   - dois arquivos com o mesmo número: um nunca rodaria;
//   - migration nova (que não existe no destino) com número que não fica acima
//     da maior do destino: num banco que já está na versão do destino, ela
//     seria pulada em silêncio (o migrador guarda só a última versão).
//
//   node scripts/check-migrations.mjs                 # só repetidos
//   node scripts/check-migrations.mjs origin/develop  # e as novas contra o destino
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const DIR = 'backend/migrations'
const MIGRATION = /^(\d+)_.+\.(up|down)\.sql$/
const UP = /\.up\.sql$/

const pad = (n) => String(n).padStart(6, '0')

/** Versão de um arquivo .up.sql (null se não for migration). */
function versionOf(name) {
  const m = MIGRATION.exec(name)
  return m ? Number(m[1]) : null
}

/**
 * `head`: nomes dos arquivos na branch; `base`: nomes no destino (ou nada).
 * Devolve a lista de erros (vazia = tudo certo).
 */
export function checkMigrations(head, base = null) {
  const errors = []
  const ups = head.filter((n) => UP.test(n))
  for (const n of ups) {
    if (versionOf(n) === null) errors.push(`${n}: nome de migration sem número (use 000123_descricao.up.sql)`)
  }

  const byVersion = new Map()
  for (const n of ups) {
    const v = versionOf(n)
    if (v === null) continue
    byVersion.set(v, [...(byVersion.get(v) ?? []), n])
  }
  for (const [v, names] of byVersion) {
    if (names.length > 1) {
      errors.push(`migrations com o mesmo número ${pad(v)}: ${names.join(', ')} — renumere uma delas`)
    }
  }

  if (base) {
    const baseUps = new Set(base.filter((n) => UP.test(n)))
    const highest = Math.max(0, ...[...baseUps].map(versionOf).filter((v) => v !== null))
    for (const n of ups) {
      const v = versionOf(n)
      if (v === null || baseUps.has(n)) continue
      if (v <= highest) {
        errors.push(
          `${n}: migration nova com número ${pad(v)}, que não fica acima da maior do destino (${pad(highest)}); ` +
            `num banco já na ${pad(highest)} ela nunca rodaria. Renumere para ${pad(highest + 1)} ou mais.`
        )
      }
    }
  }
  return errors
}

if (process.argv[1]?.endsWith('check-migrations.mjs')) {
  const baseRef = process.argv[2]
  const head = readdirSync(DIR)
  const base = baseRef
    ? execFileSync('git', ['ls-tree', '--name-only', `${baseRef}:${DIR}`], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
    : null
  const errors = checkMigrations(head, base)
  for (const e of errors) console.error(`::error::${e}`)
  if (errors.length > 0) process.exit(1)
  console.log(`migrations ok (${head.filter((n) => UP.test(n)).length}${baseRef ? `, contra ${baseRef}` : ''})`)
}
