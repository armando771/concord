import { describe, expect, it, vi } from 'vitest'
import type { ProcessMetric } from 'electron'

vi.mock('electron', () => ({ app: {}, ipcMain: {} }))

import { ProcessBreakdown } from './processBreakdown'

function proc(pid: number, type: string, cpu: number, memKB = 1024): ProcessMetric {
  return {
    pid,
    type,
    creationTime: 0,
    cpu: { cumulativeCPUUsage: cpu },
    memory: { workingSetSize: memKB }
  } as ProcessMetric
}

describe('ProcessBreakdown', () => {
  it('agrupa por tipo, soma a memória e deixa a CPU null na primeira amostra', () => {
    const stats = new ProcessBreakdown().sample(
      [proc(1, 'Browser', 1), proc(2, 'Tab', 2), proc(3, 'Tab', 3)],
      0,
      4
    )
    expect(stats).toEqual({
      Browser: { cpu: null, memMB: 1 },
      Tab: { cpu: null, memMB: 2 }
    })
  })

  it('calcula a CPU de cada grupo pela diferença entre duas leituras', () => {
    const breakdown = new ProcessBreakdown()
    breakdown.sample([proc(1, 'Browser', 1), proc(2, 'Tab', 2)], 0, 4)
    const stats = breakdown.sample([proc(1, 'Browser', 1.1), proc(2, 'Tab', 2.3)], 1000, 4)
    // 0,1 s e 0,3 s de CPU em 1 s, divididos por 4 núcleos
    expect(stats.Browser.cpu).toBe(2.5)
    expect(stats.Tab.cpu).toBe(7.5)
  })

  it('processo novo no meio não gera pico de CPU', () => {
    const breakdown = new ProcessBreakdown()
    breakdown.sample([proc(2, 'Tab', 2)], 0, 4)
    const stats = breakdown.sample([proc(2, 'Tab', 2.3), proc(9, 'Tab', 50)], 1000, 4)
    expect(stats.Tab.cpu).toBe(7.5)
  })

  it('tipos fora da lista caem em Other e grupo sem processo some', () => {
    const stats = new ProcessBreakdown().sample([proc(1, 'Zygote', 1), proc(2, 'Utility', 1)], 0, 1)
    expect(Object.keys(stats).sort()).toEqual(['Other', 'Utility'])
  })
})
