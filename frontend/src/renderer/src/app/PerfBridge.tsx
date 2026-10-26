import { useEffect } from 'react'
import { startPerfReporting } from './perfReporting'

/**
 * Medição de performance (`--perf-log`). Montado sempre no Electron, mas só age se o
 * main responder `true` em perf:enabled: sem a flag nada é observado nem enviado.
 */
function PerfBridge(): null {
  useEffect(() => {
    const perf = window.api?.perf
    if (!perf) return
    let cancelled = false
    let stop = (): void => {}
    void perf.enabled().then((enabled) => {
      if (enabled && !cancelled) stop = startPerfReporting(perf.report)
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [])
  return null
}

export default PerfBridge
