import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchAppLaunch } from './appLaunch'

class FakeDocument extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible'
}

describe('watchAppLaunch', () => {
  let win: EventTarget
  let doc: FakeDocument

  beforeEach(() => {
    vi.useFakeTimers()
    win = new EventTarget()
    doc = new FakeDocument()
  })
  afterEach(() => vi.useRealTimers())

  it('ninguém tirou o foco da página: o app não abriu', () => {
    const notOpened = vi.fn()
    watchAppLaunch(win, doc, 1500, notOpened)
    vi.advanceTimersByTime(1499)
    expect(notOpened).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(notOpened).toHaveBeenCalledTimes(1)
  })

  it('a página perdeu o foco (o app abriu na frente): sem aviso', () => {
    const notOpened = vi.fn()
    watchAppLaunch(win, doc, 1500, notOpened)
    vi.advanceTimersByTime(500)
    win.dispatchEvent(new Event('blur'))
    vi.advanceTimersByTime(5000)
    expect(notOpened).not.toHaveBeenCalled()
  })

  it('a aba ficou escondida ou saiu (pagehide): sem aviso', () => {
    const hidden = vi.fn()
    watchAppLaunch(win, doc, 1500, hidden)
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(5000)
    expect(hidden).not.toHaveBeenCalled()

    const left = vi.fn()
    watchAppLaunch(win, new FakeDocument(), 1500, left)
    win.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(5000)
    expect(left).not.toHaveBeenCalled()
  })

  it('visibilitychange para visível não conta como abrir', () => {
    const notOpened = vi.fn()
    watchAppLaunch(win, doc, 1500, notOpened)
    doc.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1500)
    expect(notOpened).toHaveBeenCalledTimes(1)
  })

  it('cancelar (saiu da página, clicou de novo) não avisa nem deixa ouvintes', () => {
    const notOpened = vi.fn()
    const stop = watchAppLaunch(win, doc, 1500, notOpened)
    stop()
    vi.advanceTimersByTime(5000)
    expect(notOpened).not.toHaveBeenCalled()
    // Depois de cancelar, um blur não muda nada (e não quebra).
    win.dispatchEvent(new Event('blur'))
  })
})
