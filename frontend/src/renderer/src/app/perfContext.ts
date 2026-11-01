import { normalizeRoute, type PerfContext } from '../../../shared/perfLog'

interface CallSnapshot {
  status: string
  isScreenSharing: boolean
  watchedScreenIds: string[]
}

/** O que o relatório de performance precisa saber do estado atual do app. */
export function buildPerfContext(pathname: string, call: CallSnapshot): PerfContext {
  return {
    route: normalizeRoute(pathname),
    inCall: call.status === 'active',
    sharing: call.isScreenSharing,
    watching: call.watchedScreenIds.length > 0
  }
}
