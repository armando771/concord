import { execFile } from 'child_process'
import { detectGame } from '../shared/gameCatalog'

// "Em atividade": olha os processos em andamento (como o Discord, não só a
// janela da frente) e avisa quando um jogo do catálogo abre ou fecha.

export interface DetectedGame {
  name: string
  /** Unix em ms de quando a Salinha o viu abrir. */
  startedAt: number
}

const POLL_INTERVAL_MS = 15_000

/** Saída de `tasklist /fo csv /nh` → nomes dos executáveis. */
export function parseTasklist(output: string): string[] {
  const names: string[] = []
  for (const line of output.split(/\r?\n/)) {
    const match = /^"([^"]+)"/.exec(line)
    if (match) names.push(match[1])
  }
  return names
}

/** Mantém o início se for o mesmo jogo; senão, começa agora (ou some). */
export function nextGame(
  previous: DetectedGame | null,
  runningExes: readonly string[],
  now: number
): DetectedGame | null {
  const game = detectGame(runningExes)
  if (!game) return null
  if (previous && previous.name === game.name) return previous
  return { name: game.name, startedAt: now }
}

function listProcesses(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/fo', 'csv', '/nh'],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => resolve(error ? [] : parseTasklist(stdout))
    )
  })
}

let timer: NodeJS.Timeout | null = null
let current: DetectedGame | null = null

/** Só no Windows. `onChange` roda quando o jogo muda (null = parou). */
export function startGameDetector(onChange: (game: DetectedGame | null) => void): void {
  if (timer || process.platform !== 'win32') return
  const tick = async (): Promise<void> => {
    const next = nextGame(current, await listProcesses(), Date.now())
    if (next?.name === current?.name) return
    current = next
    onChange(next)
  }
  void tick()
  timer = setInterval(() => void tick(), POLL_INTERVAL_MS)
}

export function stopGameDetector(onChange?: (game: DetectedGame | null) => void): void {
  if (timer) clearInterval(timer)
  timer = null
  if (current) {
    current = null
    onChange?.(null)
  }
}

/** Jogo atual (para quem liga o detector depois da janela abrir). */
export function currentGame(): DetectedGame | null {
  return current
}
