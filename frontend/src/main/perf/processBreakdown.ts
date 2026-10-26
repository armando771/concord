import type { ProcessMetric } from 'electron'
import type { ProcStats } from '../../shared/perfLog'
import { AppMetricsSampler } from '../app/appMetrics'

type Reading = Pick<ProcessMetric, 'pid' | 'creationTime' | 'memory' | 'cpu' | 'type'>

const GROUPS = ['Browser', 'Tab', 'GPU', 'Utility', 'Other']

const groupOf = (type: string): string => (GROUPS.includes(type) ? type : 'Other')
const round1 = (value: number): number => Math.round(value * 10) / 10

/** CPU e RAM do app separados por tipo de processo (um sampler por tipo). */
export class ProcessBreakdown {
  private readonly samplers = new Map(GROUPS.map((name) => [name, new AppMetricsSampler()]))

  sample(readings: Reading[], time: number, cores: number): ProcStats {
    const byGroup = new Map<string, Reading[]>()
    for (const reading of readings) {
      const group = groupOf(reading.type)
      byGroup.set(group, [...(byGroup.get(group) ?? []), reading])
    }
    const stats: ProcStats = {}
    for (const [group, sampler] of this.samplers) {
      const metrics = sampler.sample(byGroup.get(group) ?? [], time, cores)
      if (metrics.memoryMB === null) continue
      stats[group] = {
        cpu: metrics.cpuPercent === null ? null : round1(metrics.cpuPercent),
        memMB: round1(metrics.memoryMB)
      }
    }
    return stats
  }
}
