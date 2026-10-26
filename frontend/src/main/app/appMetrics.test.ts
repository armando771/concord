import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, ProcessMetric } from 'electron'

const electron = vi.hoisted(() => ({ handle: vi.fn(), getAppMetrics: vi.fn() }))
vi.mock('electron', () => ({
  app: { getAppMetrics: electron.getAppMetrics },
  ipcMain: { handle: electron.handle }
}))

import { AppMetricsSampler, setupAppMetrics } from './appMetrics'

function reading(
  pid: number,
  cpu: number | undefined,
  memory = 1024,
  creationTime = 0
): ProcessMetric {
  return {
    pid,
    creationTime,
    cpu: { cumulativeCPUUsage: cpu },
    memory: { workingSetSize: memory }
  } as ProcessMetric
}

beforeEach(() => vi.clearAllMocks())

describe('métricas do aplicativo', () => {
  it('soma RAM em MB e aquece a medição de CPU', () => {
    const sampler = new AppMetricsSampler()
    expect(sampler.sample([reading(1, 1), reading(2, 2, 2048)], 0, 4)).toEqual({
      memoryMB: 3,
      cpuPercent: null
    })
    // 2 segundos de CPU, em 2 segundos de relógio, em uma máquina de 4 threads.
    expect(sampler.sample([reading(1, 2), reading(2, 3, 2048)], 2000, 4)).toEqual({
      memoryMB: 3,
      cpuPercent: 25
    })
  })

  it('reinicia a referência ao reabrir e não confunde PID reutilizado', () => {
    const sampler = new AppMetricsSampler()
    sampler.sample([reading(1, 10)], 0, 4)
    expect(sampler.sample([reading(1, 20)], 2000, 4, true).cpuPercent).toBeNull()
    expect(sampler.sample([reading(1, 30, 1024, 1)], 4000, 4).cpuPercent).toBeNull()
  })

  it('trata métricas ausentes, processos novos/encerrados e valores inválidos', () => {
    const sampler = new AppMetricsSampler()
    expect(sampler.sample([], 0, 0)).toEqual({ memoryMB: null, cpuPercent: null })
    expect(sampler.sample([reading(1, undefined, NaN)], 2000, 4)).toEqual({
      memoryMB: null,
      cpuPercent: null
    })
    sampler.sample([reading(1, 1), reading(2, 10)], 4000, 4)
    expect(sampler.sample([reading(1, 1), reading(3, 100)], 6000, 4).cpuPercent).toBe(0)
    expect(sampler.sample([reading(1, 100)], 8000, 1).cpuPercent).toBe(100)
  })

  it('só aceita IPC da janela principal e do frame principal', async () => {
    const webContents = { mainFrame: {} }
    const win = { isDestroyed: () => false, webContents } as unknown as BrowserWindow
    setupAppMetrics(() => win)
    const handler = electron.handle.mock.calls[0][1]
    expect(handler({ sender: {}, senderFrame: webContents.mainFrame })).toBeNull()
    expect(handler({ sender: webContents, senderFrame: {} })).toBeNull()
    expect(electron.getAppMetrics).not.toHaveBeenCalled()
    electron.getAppMetrics.mockReturnValue([reading(1, 0)])
    expect(
      await handler({ sender: webContents, senderFrame: webContents.mainFrame }, true)
    ).toEqual({ memoryMB: 1, cpuPercent: null })
  })
})
