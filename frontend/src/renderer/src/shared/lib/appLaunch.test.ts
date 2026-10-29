import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { looksLikeDesktop, watchAppLaunch } from './appLaunch'

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

  it('onOpened avisa quando a página perde o foco, some ou fica escondida', () => {
    for (const trigger of [
      () => win.dispatchEvent(new Event('blur')),
      () => win.dispatchEvent(new Event('pagehide')),
      () => {
        doc.visibilityState = 'hidden'
        doc.dispatchEvent(new Event('visibilitychange'))
      }
    ]) {
      const notOpened = vi.fn()
      const opened = vi.fn()
      watchAppLaunch(win, (doc = new FakeDocument()), 1500, notOpened, opened)
      trigger()
      trigger()
      vi.advanceTimersByTime(5000)
      expect(opened).toHaveBeenCalledTimes(1)
      expect(notOpened).not.toHaveBeenCalled()
    }
  })

  it('onOpened não é chamado se deu o tempo ou se cancelou', () => {
    const opened = vi.fn()
    watchAppLaunch(win, doc, 1500, () => {}, opened)
    vi.advanceTimersByTime(1500)
    win.dispatchEvent(new Event('blur'))
    expect(opened).not.toHaveBeenCalled()

    const stop = watchAppLaunch(win, doc, 1500, () => {}, opened)
    stop()
    win.dispatchEvent(new Event('blur'))
    expect(opened).not.toHaveBeenCalled()
  })
})

describe('looksLikeDesktop', () => {
  it('computadores', () => {
    for (const ua of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
    ]) {
      expect(looksLikeDesktop(ua, 0), ua).toBe(true)
    }
  })

  it('celulares e tablets', () => {
    for (const ua of [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36'
    ]) {
      expect(looksLikeDesktop(ua, 5), ua).toBe(false)
    }
    // iPadOS se apresenta como Mac, mas tem toque.
    expect(looksLikeDesktop('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(false)
  })

  it('sem user agent, não tenta', () => {
    expect(looksLikeDesktop('')).toBe(false)
  })
})
