// Leitura de processos que escrevem uma linha por evento (o helper nativo ou
// o PowerShell do SMTC) e quando abrir de novo um que caiu. Puro.

/** Linha maior que isso é lixo: descarta para não crescer sem limite. */
const MAX_LINE_CHARS = 256 * 1024

/** Recebe pedaços do stdout e chama `onLine` com cada linha inteira (sem vazias). */
export function lineSplitter(
  onLine: (line: string) => void,
  maxChars = MAX_LINE_CHARS
): (chunk: string) => void {
  let buffer = ''
  return (chunk) => {
    buffer += chunk
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    if (buffer.length > maxChars) buffer = ''
    for (const part of parts) {
      const line = part.replace(/\r$/, '').trim()
      if (line && line.length <= maxChars) onLine(line)
    }
  }
}

/** Espera antes de reabrir, pelo número de quedas seguidas logo ao abrir; null = desistir. */
export function restartDelay(failures: number): number | null {
  if (failures >= 3) return null
  return failures < 2 ? 30_000 : 60_000
}

/** Caiu logo ao abrir (menos que isso de vida) conta como falha seguida. */
const QUICK_EXIT_MS = 10_000

/** Quedas seguidas logo ao abrir: soma uma; se ele viveu bem, zera. */
export function nextFailures(failures: number, livedMs: number): number {
  return livedMs < QUICK_EXIT_MS ? failures + 1 : 0
}

/** O helper nativo saiu logo sem nenhuma leitura: não serve (exe antigo, SMTC falhou nele). */
export function helperBroken(livedMs: number, gotLine: boolean): boolean {
  return !gotLine && livedMs < QUICK_EXIT_MS
}
