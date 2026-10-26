import { describe, expect, it } from 'vitest'
import { FrameStats } from './frameStats'

describe('FrameStats', () => {
  it('FPS = quadros / segundos da janela', () => {
    const stats = new FrameStats(0)
    for (let i = 0; i < 60; i++) stats.frame()
    expect(stats.take(1000).fps).toBe(60)
  })

  it('a janela reinicia a cada take', () => {
    const stats = new FrameStats(0)
    for (let i = 0; i < 30; i++) stats.frame()
    stats.take(1000)
    for (let i = 0; i < 10; i++) stats.frame()
    expect(stats.take(3000).fps).toBe(5)
  })

  it('LoAF: conta, maior e soma só dos quadros acima de 50 ms', () => {
    const stats = new FrameStats(0)
    stats.longFrame(50)
    stats.longFrame(51.26)
    stats.longFrame(120)
    expect(stats.take(1000).loaf).toEqual({ count: 2, maxMs: 120, totalMs: 171.3 })
  })

  it('o LoAF também zera entre janelas', () => {
    const stats = new FrameStats(0)
    stats.longFrame(100)
    stats.take(1000)
    expect(stats.take(2000).loaf).toEqual({ count: 0, maxMs: 0, totalMs: 0 })
  })

  it('janela de duração zero não divide por zero', () => {
    const stats = new FrameStats(500)
    stats.frame()
    expect(Number.isFinite(stats.take(500).fps)).toBe(true)
  })
})
