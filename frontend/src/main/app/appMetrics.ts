import { app, ipcMain, type BrowserWindow, type ProcessMetric } from 'electron'
import { cpus } from 'node:os'
import type { AppMetrics } from '../../shared/appMetrics'

type Reading = Pick<ProcessMetric, 'pid' | 'creationTime' | 'memory' | 'cpu'>

/** CPU cumulativa evita que outras chamadas a getAppMetrics alterem nosso intervalo. */
export class AppMetricsSampler {
  private previous: { time: number; cpu: Map<string, number> } | null = null

  sample(readings: Reading[], time: number, cores: number, reset = false): AppMetrics {
    const previous = reset ? null : this.previous
    const cpu = new Map<string, number>()
    let memoryKB = 0
    let memoryAvailable = false
    let cpuSeconds = 0
    let cpuAvailable = false
    for (const reading of readings) {
      const memory = reading.memory?.workingSetSize
      if (Number.isFinite(memory) && memory >= 0) {
        memoryKB += memory
        memoryAvailable = true
      }
      const total = reading.cpu.cumulativeCPUUsage
      if (total === undefined || !Number.isFinite(total) || total < 0) continue
      const key = `${reading.pid}:${reading.creationTime}`
      cpu.set(key, total)
      const before = previous?.cpu.get(key)
      if (before !== undefined && total >= before) {
        cpuSeconds += total - before
        cpuAvailable = true
      }
    }
    this.previous = { time, cpu }
    const elapsed = previous ? (time - previous.time) / 1000 : 0
    return {
      memoryMB: memoryAvailable ? memoryKB / 1024 : null,
      cpuPercent:
        cpuAvailable && elapsed > 0
          ? Math.min(100, (cpuSeconds / elapsed / Math.max(1, cores)) * 100)
          : null
    }
  }
}

export function setupAppMetrics(getWindow: () => BrowserWindow | null): void {
  const sampler = new AppMetricsSampler()
  const cores = cpus().length
  ipcMain.handle('app-metrics:sample', (event, reset: unknown) => {
    const win = getWindow()
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return null
    if (event.senderFrame !== win.webContents.mainFrame) return null
    return sampler.sample(app.getAppMetrics(), performance.now(), cores, reset === true)
  })
}
