import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWindowActivityStore } from '../../../shared/store/windowActivityStore'
import { useScreenVisibilityStore } from '../store/screenVisibilityStore'
import {
  OFFSCREEN_PAUSE_MS,
  offscreenLives,
  videoEnabled,
  watchVideoPause,
  type VideoPauseState
} from './screenVideoPause'

const state = (windowHidden: boolean, offscreen: string[] = []): VideoPauseState => ({
  windowHidden,
  offscreen: new Set(offscreen)
})

describe('videoEnabled', () => {
  it('janela minimizada ou na bandeja: pausa todo vídeo (tela e câmera)', () => {
    expect(videoEnabled('screen_share', 'bia', state(true))).toBe(false)
    expect(videoEnabled('camera', 'bia', state(true))).toBe(false)
  })

  it('live fora da área visível do app: pausa só o vídeo dessa live', () => {
    const s = state(false, ['bia'])
    expect(videoEnabled('screen_share', 'bia', s)).toBe(false)
    expect(videoEnabled('screen_share', 'caio', s)).toBe(true)
    expect(videoEnabled('camera', 'bia', s)).toBe(true)
  })

  it('visível: toca', () => {
    expect(videoEnabled('screen_share', 'bia', state(false))).toBe(true)
  })
})

describe('offscreenLives', () => {
  it('fora de vista só quando todo <video> daquela live está fora', () => {
    expect(
      offscreenLives({
        a: { userId: 'bia', visible: false },
        b: { userId: 'bia', visible: true },
        c: { userId: 'caio', visible: false },
        d: { userId: 'caio', visible: false }
      })
    ).toEqual(['caio'])
    expect(offscreenLives({})).toEqual([])
  })
})

describe('watchVideoPause', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useWindowActivityStore.getState().setActivity({ focused: true, visible: true })
    useScreenVisibilityStore.setState({ elements: {} })
  })
  afterEach(() => vi.useRealTimers())

  const offscreenOf = (onChange: ReturnType<typeof vi.fn>): string[] => [
    ...(onChange.mock.lastCall?.[0] as VideoPauseState).offscreen
  ]
  const hiddenOf = (onChange: ReturnType<typeof vi.fn>): boolean =>
    (onChange.mock.lastCall?.[0] as VideoPauseState).windowHidden

  it('avisa já; minimizar pausa na hora; perder o foco (alt-tab, outro monitor) não', () => {
    const onChange = vi.fn()
    const stop = watchVideoPause(onChange)
    expect(hiddenOf(onChange)).toBe(false)
    useWindowActivityStore.getState().setActivity({ focused: false, visible: true })
    expect(onChange).toHaveBeenCalledTimes(1)
    useWindowActivityStore.getState().setActivity({ focused: false, visible: false })
    expect(hiddenOf(onChange)).toBe(true)
    useWindowActivityStore.getState().setActivity({ focused: true, visible: true })
    expect(hiddenOf(onChange)).toBe(false)
    stop()
    useWindowActivityStore.getState().setActivity({ focused: false, visible: false })
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('fora de vista pausa depois de um instante (rolagem não pisca); voltar é imediato', () => {
    const onChange = vi.fn()
    const stop = watchVideoPause(onChange)
    const visibility = useScreenVisibilityStore.getState()
    visibility.report('v1', 'bia', true)
    visibility.report('v1', 'bia', false)
    vi.advanceTimersByTime(OFFSCREEN_PAUSE_MS - 1)
    expect(offscreenOf(onChange)).toEqual([])
    visibility.report('v1', 'bia', true)
    vi.advanceTimersByTime(OFFSCREEN_PAUSE_MS)
    expect(offscreenOf(onChange)).toEqual([])
    visibility.report('v1', 'bia', false)
    vi.advanceTimersByTime(OFFSCREEN_PAUSE_MS)
    expect(offscreenOf(onChange)).toEqual(['bia'])
    const calls = onChange.mock.calls.length
    visibility.report('v1', 'bia', true)
    expect(onChange).toHaveBeenCalledTimes(calls + 1)
    expect(offscreenOf(onChange)).toEqual([])
    stop()
  })

  it('o <video> que sumiu deixa de contar; parar cancela a pausa pendente', () => {
    const onChange = vi.fn()
    const stop = watchVideoPause(onChange)
    const visibility = useScreenVisibilityStore.getState()
    visibility.report('v1', 'bia', false)
    visibility.remove('v1')
    vi.advanceTimersByTime(OFFSCREEN_PAUSE_MS)
    expect(offscreenOf(onChange)).toEqual([])
    visibility.report('v2', 'bia', false)
    stop()
    vi.advanceTimersByTime(OFFSCREEN_PAUSE_MS)
    expect(offscreenOf(onChange)).toEqual([])
  })
})
