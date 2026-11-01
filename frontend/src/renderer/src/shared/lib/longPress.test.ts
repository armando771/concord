import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLongPress, swallowNextClick } from './longPress'

describe('createLongPress', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const touch = (x = 0, y = 0) => ({ pointerType: 'touch', clientX: x, clientY: y })

  it('segurar o dedo parado dispara depois do tempo', () => {
    const onFire = vi.fn()
    const lp = createLongPress(onFire, { delay: 450 })
    lp.down(touch(10, 10))
    vi.advanceTimersByTime(449)
    expect(onFire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFire).toHaveBeenCalledOnce()
  })

  it('soltar antes não dispara (é um toque comum)', () => {
    const onFire = vi.fn()
    const lp = createLongPress(onFire, { delay: 450 })
    lp.down(touch())
    vi.advanceTimersByTime(200)
    lp.cancel()
    vi.advanceTimersByTime(500)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('arrastar (rolar a lista) cancela; tremidinha não', () => {
    const onFire = vi.fn()
    const lp = createLongPress(onFire, { delay: 450, tolerance: 10 })
    lp.down(touch(0, 0))
    lp.move(touch(4, 6))
    vi.advanceTimersByTime(450)
    expect(onFire).toHaveBeenCalledOnce()

    lp.down(touch(0, 0))
    lp.move(touch(0, 25))
    vi.advanceTimersByTime(450)
    expect(onFire).toHaveBeenCalledOnce()
  })

  it('mouse e caneta ficam com o botão direito de sempre', () => {
    const onFire = vi.fn()
    const lp = createLongPress(onFire)
    lp.down({ pointerType: 'mouse', clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(1000)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('lembra que acabou de disparar (o contextmenu do Android vem logo depois)', () => {
    const lp = createLongPress(() => {}, { delay: 450 })
    expect(lp.firedRecently()).toBe(false)
    lp.down(touch())
    vi.advanceTimersByTime(450)
    expect(lp.firedRecently()).toBe(true)
    vi.advanceTimersByTime(1500)
    expect(lp.firedRecently()).toBe(false)
  })
})

describe('swallowNextClick', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const click = () => {
    const e = new Event('click', { cancelable: true })
    return e
  }

  // No app o alvo é a window na captura: roda antes de qualquer outro ouvinte.
  it('o clique logo depois de segurar não chega a ninguém', () => {
    const target = new EventTarget()
    const heard = vi.fn()
    swallowNextClick(target)
    target.addEventListener('click', heard)
    const e = click()
    target.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(heard).not.toHaveBeenCalled()
  })

  it('só o primeiro: o clique seguinte passa', () => {
    const target = new EventTarget()
    const heard = vi.fn()
    swallowNextClick(target)
    target.addEventListener('click', heard)
    target.dispatchEvent(click())
    target.dispatchEvent(click())
    expect(heard).toHaveBeenCalledOnce()
  })

  it('se o clique não vier logo, para de esperar', () => {
    const target = new EventTarget()
    const heard = vi.fn()
    target.addEventListener('click', heard)
    swallowNextClick(target, 600)
    vi.advanceTimersByTime(601)
    target.dispatchEvent(click())
    expect(heard).toHaveBeenCalledOnce()
  })
})
