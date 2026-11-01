import { afterEach, describe, expect, it, vi } from 'vitest'
import { WindowWatch } from './windowWatch'

describe('WindowWatch', () => {
  afterEach(() => vi.useRealTimers())

  it('avisa uma vez por minimização e de novo se voltar a sumir', async () => {
    vi.useFakeTimers()
    let ids = ['window:1:0']
    const onHidden = vi.fn()
    const watch = new WindowWatch(async () => ids, onHidden, 100)
    watch.watch('window:1:0')

    await vi.advanceTimersByTimeAsync(100)
    expect(onHidden).not.toHaveBeenCalled()
    ids = []
    await vi.advanceTimersByTimeAsync(300)
    expect(onHidden).toHaveBeenCalledTimes(1)
    ids = ['window:1:0']
    await vi.advanceTimersByTimeAsync(100)
    ids = []
    await vi.advanceTimersByTimeAsync(100)
    expect(onHidden).toHaveBeenCalledTimes(2)
    watch.stop()
  })

  it('stop para de vigiar e falha ao listar não derruba', async () => {
    vi.useFakeTimers()
    const onHidden = vi.fn()
    const watch = new WindowWatch(async () => Promise.reject(new Error('x')), onHidden, 100)
    watch.watch('window:1:0')
    await vi.advanceTimersByTimeAsync(200)
    watch.stop()
    await vi.advanceTimersByTimeAsync(200)
    expect(onHidden).not.toHaveBeenCalled()
  })
})
