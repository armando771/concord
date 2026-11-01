import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Harness mínimo (sem DOM simulado): roda o efeito na hora.
const harness = vi.hoisted(() => ({ cleanup: undefined as (() => void) | undefined }))
vi.mock('react', () => ({
  useId: () => 'v1',
  useEffect: (effect: () => (() => void) | undefined) => {
    harness.cleanup = effect()
  }
}))

import { useLiveInView } from './useLiveInView'
import { useScreenVisibilityStore } from '../store/screenVisibilityStore'

class FakeObserver {
  static last: FakeObserver | null = null
  observed: Element[] = []
  disconnect = vi.fn()
  constructor(public callback: (entries: { isIntersecting: boolean }[]) => void) {
    FakeObserver.last = this
  }
  observe(el: Element): void {
    this.observed.push(el)
  }
}

const elements = () => useScreenVisibilityStore.getState().elements
const el = {} as Element

beforeEach(() => {
  useScreenVisibilityStore.setState({ elements: {} })
  FakeObserver.last = null
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})
afterEach(() => {
  harness.cleanup?.()
  harness.cleanup = undefined
  vi.unstubAllGlobals()
})

describe('useLiveInView', () => {
  it('começa visível, segue o observer e esquece ao desmontar', () => {
    useLiveInView('bia', { current: el })
    expect(FakeObserver.last?.observed).toEqual([el])
    expect(elements()).toEqual({ v1: { userId: 'bia', visible: true } })
    FakeObserver.last?.callback([{ isIntersecting: true }, { isIntersecting: false }])
    expect(elements().v1.visible).toBe(false)
    FakeObserver.last?.callback([])
    expect(elements().v1.visible).toBe(false)
    harness.cleanup?.()
    expect(FakeObserver.last?.disconnect).toHaveBeenCalled()
    expect(elements()).toEqual({})
  })

  it('minha live, câmera ou sem IntersectionObserver: não observa', () => {
    useLiveInView(null, { current: el })
    expect(FakeObserver.last).toBeNull()
    vi.stubGlobal('IntersectionObserver', undefined)
    useLiveInView('bia', { current: el })
    expect(elements()).toEqual({})
  })
})
