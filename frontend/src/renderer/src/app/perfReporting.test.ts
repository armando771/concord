import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerfEvent } from '../../../shared/perfLog'

const stores = vi.hoisted(() => ({
  call: { status: 'idle', isScreenSharing: false, watchedScreenIds: [] as string[] },
  loaded: false,
  listeners: [] as Array<(state: { serversLoaded: boolean }) => void>
}))

vi.mock('../features/call/store/callStore', () => ({
  useCallStore: { getState: () => stores.call }
}))
vi.mock('../features/servers/store/serverStore', () => ({
  useServerStore: {
    getState: () => ({ serversLoaded: stores.loaded }),
    subscribe: (listener: (state: { serversLoaded: boolean }) => void) => {
      stores.listeners.push(listener)
      return () => {
        stores.listeners = stores.listeners.filter((l) => l !== listener)
      }
    }
  }
}))
vi.mock('./router', () => ({
  router: { state: { location: { pathname: '/servers/42' } } }
}))

import { startPerfReporting } from './perfReporting'

class FakeObserver {
  static supportedEntryTypes: string[] = ['long-animation-frame']
  static created: FakeObserver[] = []
  disconnected = false
  constructor(private readonly callback: (list: { getEntries(): Array<{ duration: number }> }) => void) {
    FakeObserver.created.push(this)
  }
  observe(): void {
    // o teste dispara as entradas por emit()
  }
  disconnect(): void {
    this.disconnected = true
  }
  emit(duration: number): void {
    this.callback({ getEntries: () => [{ duration }] })
  }
}

let frame: (() => void) | null
let cancelFrame: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance']
  })
  stores.call = { status: 'idle', isScreenSharing: false, watchedScreenIds: [] }
  stores.loaded = false
  stores.listeners = []
  FakeObserver.supportedEntryTypes = ['long-animation-frame']
  FakeObserver.created = []
  frame = null
  cancelFrame = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frame = cb
    return 7
  })
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)
  vi.stubGlobal('PerformanceObserver', FakeObserver)
  vi.stubGlobal('document', { hidden: false })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function start(): { sent: PerfEvent[]; stop: () => void } {
  const sent: PerfEvent[] = []
  const stop = startPerfReporting((event) => sent.push(event))
  return { sent, stop }
}

describe('startPerfReporting: relatório', () => {
  it('manda um relatório por segundo com contexto, FPS e LoAF', () => {
    stores.call = { status: 'active', isScreenSharing: true, watchedScreenIds: ['u1'] }
    const { sent, stop } = start()
    for (let i = 0; i < 60; i++) frame!()
    FakeObserver.created[0].emit(120)
    vi.advanceTimersByTime(1000)
    expect(sent).toEqual([
      {
        kind: 'report',
        ctx: { route: '/servers/:id', inCall: true, sharing: true, watching: true },
        fps: 60,
        loaf: { count: 1, maxMs: 120, totalMs: 120 }
      }
    ])
    stop()
  })

  it('janela oculta (document.hidden): fps e loaf viram null', () => {
    vi.stubGlobal('document', { hidden: true })
    const { sent, stop } = start()
    FakeObserver.created[0].emit(1000)
    vi.advanceTimersByTime(1000)
    expect(sent[0]).toMatchObject({ kind: 'report', fps: null, loaf: null })
    stop()
  })

  it('sem suporte a Long Animation Frames: loaf null e nenhum observer', () => {
    FakeObserver.supportedEntryTypes = []
    const { sent, stop } = start()
    vi.advanceTimersByTime(1000)
    expect(FakeObserver.created).toHaveLength(0)
    expect(sent[0]).toMatchObject({ kind: 'report', loaf: null })
    stop()
  })
})

describe('startPerfReporting: marco usable', () => {
  it('manda na partida se a lista de servidores já está carregada', () => {
    stores.loaded = true
    const { sent, stop } = start()
    expect(sent).toEqual([{ kind: 'mark', name: 'usable' }])
    stop()
  })

  it('manda quando a lista carrega depois, uma vez só', () => {
    const { sent, stop } = start()
    expect(sent).toEqual([])
    ;[...stores.listeners].forEach((l) => l({ serversLoaded: false }))
    expect(sent).toEqual([])
    ;[...stores.listeners].forEach((l) => l({ serversLoaded: true }))
    ;[...stores.listeners].forEach((l) => l({ serversLoaded: true }))
    expect(sent).toEqual([{ kind: 'mark', name: 'usable' }])
    stop()
  })
})

describe('startPerfReporting: parar', () => {
  it('desliga rAF, timer, observer e a inscrição no store', () => {
    const { sent, stop } = start()
    stop()
    expect(cancelFrame).toHaveBeenCalledWith(7)
    expect(vi.getTimerCount()).toBe(0)
    expect(FakeObserver.created[0].disconnected).toBe(true)
    expect(stores.listeners).toHaveLength(0)
    vi.advanceTimersByTime(5000)
    expect(sent).toEqual([])
  })
})
