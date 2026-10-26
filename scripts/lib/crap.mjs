// CRAP (Change Risk Anti-Patterns): complexidade alta sem teste é risco.
//   CRAP = complexidade² × (1 − cobertura)³ + complexidade
export const LIMIT = 15

export const crap = (complexity, coverage) => complexity ** 2 * (1 - coverage) ** 3 + complexity

// touches: a função cruza alguma das faixas de linhas alteradas?
export const touches = (fn, ranges) => ranges.some(([start, end]) => start <= fn.end && end >= fn.start)

// evaluate separa as funções acima do limite em falhas (tocadas) e avisos
// (no mesmo arquivo, mas não tocadas). Com wholeFile tudo conta como tocado.
export function evaluate(fns, changes, { limit = LIMIT, wholeFile = false } = {}) {
  const rows = fns.map((fn) => ({ ...fn, crap: crap(fn.complexity, fn.coverage) }))
  const touched = (fn) => wholeFile || touches(fn, changes[fn.file] ?? [])
  const over = (fn) => fn.crap > limit
  const touchedRows = rows.filter(touched)
  return {
    rows,
    touched: touchedRows,
    failures: touchedRows.filter(over),
    warnings: rows.filter((fn) => over(fn) && !touched(fn))
  }
}

const HEADER = ['| Local | Função | Complexidade | Cobertura | CRAP |', '|---|---|---|---|---|']

const line = (limit) => (fn) =>
  `| ${fn.file}:${fn.start} | ${fn.name} | ${fn.complexity} | ${Math.round(fn.coverage * 100)}% | ${fn.crap > limit ? '❌ ' : ''}${fn.crap.toFixed(1)} |`

// formatReport gera o relatório em Markdown que vai no PR (tabela das funções
// tocadas, que é o "antes/depois", e os avisos do resto dos arquivos).
export function formatReport({ rows, touched, failures, warnings }, limit = LIMIT) {
  const out = [`CRAP: ${touched.length} função(ões) tocada(s) de ${rows.length} medidas, limite ${limit}.`]
  if (touched.length) out.push('', ...HEADER, ...touched.map(line(limit)))
  if (warnings.length) out.push('', `⚠️ ${warnings.length} função(ões) não tocada(s) acima do limite nos mesmos arquivos:`, ...HEADER, ...warnings.map(line(limit)))
  out.push('', failures.length ? `❌ ${failures.length} função(ões) tocada(s) acima do limite: refatore ou teste.` : '✅ Nenhuma função tocada acima do limite.')
  return out.join('\n')
}
