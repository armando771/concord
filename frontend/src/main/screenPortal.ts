import { execFile } from 'child_process'
import {
  PORTAL_PROBES,
  portalStatus,
  type PortalStatus,
  type ProbeOutcome
} from '../shared/screenShareFlow'

const PROBE_TIMEOUT_MS = 4000

/** Erro do execFile → resultado da sondagem (puro, para testar). */
export function probeOutcome(
  err: (Error & { code?: unknown; killed?: boolean; signal?: unknown }) | null
): ProbeOutcome {
  if (!err) return 'ok'
  if (err.code === 'ENOENT') return 'no-tool'
  if (err.killed || err.signal === 'SIGTERM') return 'timeout'
  return 'failed'
}

function probe(cmd: string, args: string[]): Promise<ProbeOutcome> {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: PROBE_TIMEOUT_MS, windowsHide: true }, (err) =>
        resolve(probeOutcome(err))
      )
    } catch {
      resolve('no-tool')
    }
  })
}

/**
 * O xdg-desktop-portal tem a interface ScreenCast (algum backend instalado)?
 * Pergunta por D-Bus com a primeira ferramenta que existir.
 */
export async function checkScreenCastPortal(): Promise<PortalStatus> {
  const outcomes: ProbeOutcome[] = []
  for (const { cmd, args } of PORTAL_PROBES) {
    const outcome = await probe(cmd, args)
    outcomes.push(outcome)
    if (outcome !== 'no-tool') break
  }
  return portalStatus(outcomes)
}
