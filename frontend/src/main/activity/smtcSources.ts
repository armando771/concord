import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import type { SmtcSources } from './smtcMedia'
import { spawnSmtcPowerShell } from './smtcPowerShell'

// As fontes do SMTC neste PC: o helper nativo, quando o exe está no lugar, e o
// PowerShell de reserva (docs/adr/0006-musica-em-atividade.md).

function spawnHelper(path: string): ChildProcess {
  // stdin aberto: quando a Salinha morre, o pipe fecha e o helper sai junto.
  return spawn(path, ['media-watch'], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
}

/** `helperPath` = onde fica o concord-audio.exe (null = não procurar). */
export function smtcSources(
  helperPath: string | null,
  log?: (message: string) => void
): SmtcSources {
  const helper = helperPath && existsSync(helperPath) ? () => spawnHelper(helperPath) : null
  return { helper, powershell: spawnSmtcPowerShell, log }
}
