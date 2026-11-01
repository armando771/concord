import { describe, expect, it, vi } from 'vitest'
import { createSwipeTracker, isSwipeToList } from './swipe'

const base = { startX: 120, width: 360, dx: 120, dy: 10, ms: 250 }

describe('isSwipeToList', () => {
  it('arrastar o dedo para a direita no chat volta para a lista', () => {
    expect(isSwipeToList(base)).toBe(true)
  })

  it('arrasto curto não conta (era um toque ou começo de rolagem)', () => {
    expect(isSwipeToList({ ...base, dx: 40 })).toBe(false)
  })

  it('para a esquerda não volta', () => {
    expect(isSwipeToList({ ...base, dx: -120 })).toBe(false)
  })

  it('rolando a lista na vertical (diagonal) não volta', () => {
    expect(isSwipeToList({ ...base, dx: 90, dy: 60 })).toBe(false)
  })

  it('a partir da beirada da tela é o "voltar" do sistema: não mexe', () => {
    expect(isSwipeToList({ ...base, startX: 8 })).toBe(false)
  })

  it('arrasto lento demais (segurou e arrastou) não conta', () => {
    expect(isSwipeToList({ ...base, ms: 1200 })).toBe(false)
  })
})

describe('createSwipeTracker', () => {
  const finger = { x: 120, y: 400, t: 0, fingers: 1, own: false }
  const lift = { x: 260, y: 410, t: 250, width: 360 }

  it('arrastou para a direita: chama', () => {
    const onSwipe = vi.fn()
    const tracker = createSwipeTracker(onSwipe)
    tracker.start(finger)
    tracker.end(lift)
    expect(onSwipe).toHaveBeenCalledOnce()
  })

  it('dois dedos (pinça) ou começo num lugar com gesto próprio: não chama', () => {
    const onSwipe = vi.fn()
    const tracker = createSwipeTracker(onSwipe)
    tracker.start({ ...finger, fingers: 2 })
    tracker.end(lift)
    tracker.start({ ...finger, own: true })
    tracker.end(lift)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('fim sem começo, ou sem posição: não chama', () => {
    const onSwipe = vi.fn()
    const tracker = createSwipeTracker(onSwipe)
    tracker.end(lift)
    tracker.start(finger)
    tracker.end(null)
    tracker.end(lift)
    expect(onSwipe).not.toHaveBeenCalled()
  })
})
