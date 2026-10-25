import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AutoHide,
  ClickDisambiguator,
  CONTROLS_HIDE_DELAY_MS,
  DOUBLE_CLICK_MS,
  isInteractiveTarget
} from './fullscreenControls'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('AutoHide', () => {
  it('some depois de ~2,5 s sem mexer o mouse', () => {
    const onChange = vi.fn()
    const hide = new AutoHide(onChange)
    hide.start()
    vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS - 1)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('mexer o mouse reinicia a contagem', () => {
    const onChange = vi.fn()
    const hide = new AutoHide(onChange)
    hide.start()
    vi.advanceTimersByTime(2000)
    hide.show()
    vi.advanceTimersByTime(2000)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('mexer o mouse com a barra escondida mostra de novo (uma vez só)', () => {
    const onChange = vi.fn()
    const hide = new AutoHide(onChange)
    hide.start()
    vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS)
    hide.show()
    hide.show()
    expect(onChange.mock.calls).toEqual([[false], [true]])
    vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS)
    expect(onChange.mock.calls).toEqual([[false], [true], [false]])
  })

  it('com o mouse em cima da barra ela não some; ao sair, volta a contar', () => {
    const onChange = vi.fn()
    const hide = new AutoHide(onChange)
    hide.start()
    hide.hold()
    vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS * 4)
    expect(onChange).not.toHaveBeenCalled()
    hide.release()
    vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS)
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('stop cancela a contagem pendente', () => {
    const onChange = vi.fn()
    const hide = new AutoHide(onChange)
    hide.start()
    hide.stop()
    vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS * 2)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ClickDisambiguator', () => {
  it('clique simples dispara depois da janela de duplo clique', () => {
    const action = vi.fn()
    const clicks = new ClickDisambiguator()
    clicks.click(action)
    vi.advanceTimersByTime(DOUBLE_CLICK_MS - 1)
    expect(action).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(action).toHaveBeenCalledOnce()
  })

  it('duplo clique cancela o clique pendente', () => {
    const action = vi.fn()
    const clicks = new ClickDisambiguator()
    clicks.click(action)
    clicks.cancel()
    vi.advanceTimersByTime(DOUBLE_CLICK_MS * 2)
    expect(action).not.toHaveBeenCalled()
  })

  it('cliques seguidos agendam só o último', () => {
    const first = vi.fn()
    const second = vi.fn()
    const clicks = new ClickDisambiguator()
    clicks.click(first)
    vi.advanceTimersByTime(100)
    clicks.click(second)
    vi.advanceTimersByTime(DOUBLE_CLICK_MS)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})

describe('isInteractiveTarget', () => {
  const target = (hit: boolean): { closest: (s: string) => unknown } => ({
    closest: () => (hit ? {} : null)
  })

  it('controles não contam como vídeo', () => {
    expect(isInteractiveTarget(target(true))).toBe(true)
  })

  it('o vídeo em si conta', () => {
    expect(isInteractiveTarget(target(false))).toBe(false)
    expect(isInteractiveTarget(null)).toBe(false)
  })
})
