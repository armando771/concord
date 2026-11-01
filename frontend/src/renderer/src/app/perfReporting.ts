import type { PerfEvent, PerfReport } from '../../../shared/perfLog'
import { useCallStore } from '../features/call/store/callStore'
import { useServerStore } from '../features/servers/store/serverStore'
import { FrameStats } from '../shared/lib/perf/frameStats'
import { buildPerfContext } from './perfContext'
import { router } from './router'

const REPORT_MS = 1000

/** null quando o Chromium não suporta Long Animation Frames. */
function observeLongFrames(onDuration: (ms: number) => void): PerformanceObserver | null {
  if (!PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) return null
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) onDuration(entry.duration)
  })
  observer.observe({ type: 'long-animation-frame' })
  return observer
}

/** "Primeira tela usável" = a lista de servidores chegou. Só lê o store. */
function whenServersLoaded(onLoaded: () => void): () => void {
  if (useServerStore.getState().serversLoaded) {
    onLoaded()
    return () => {}
  }
  const unsubscribe = useServerStore.subscribe((state) => {
    if (!state.serversLoaded) return
    unsubscribe()
    onLoaded()
  })
  return unsubscribe
}

function buildReport(stats: FrameStats, loafSupported: boolean): PerfReport {
  const { fps, loaf } = stats.take(performance.now())
  // Oculta o rAF é limitado: FPS e LoAF dessa janela não representam o app (o main também
  // só os aceita com a janela visível).
  const measurable = !document.hidden
  return {
    kind: 'report',
    ctx: buildPerfContext(router.state.location.pathname, useCallStore.getState()),
    fps: measurable ? fps : null,
    loaf: measurable && loafSupported ? loaf : null
  }
}

/** Observa quadros, LoAF e o estado do app e manda um relatório por segundo. */
export function startPerfReporting(send: (event: PerfEvent) => void): () => void {
  const stats = new FrameStats(performance.now())
  let frame = requestAnimationFrame(function tick() {
    stats.frame()
    frame = requestAnimationFrame(tick)
  })
  const observer = observeLongFrames((ms) => stats.longFrame(ms))
  const stopMark = whenServersLoaded(() => send({ kind: 'mark', name: 'usable' }))
  const timer = setInterval(() => send(buildReport(stats, observer !== null)), REPORT_MS)
  return () => {
    cancelAnimationFrame(frame)
    clearInterval(timer)
    observer?.disconnect()
    stopMark()
  }
}
