import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessMetric } from 'electron'

vi.mock('electron', () => ({ app: {}, ipcMain: {} }))

import type { PerfReport } from '../../shared/perfLog'
import { PerfSession } from './perfSession'

const tab = (cpu: number): ProcessMetric =>
  ({
    pid: 2,
    type: 'Tab',
    creationTime: 0,
    cpu: { cumulativeCPUUsage: cpu },
    memory: { workingSetSize: 2048 }
  }) as ProcessMetric

const report = (route = '/channels/:id'): PerfReport => ({
  kind: 'report',
  ctx: { route, inCall: true, sharing: false, watching: false },
  fps: 60,
  loaf: { count: 1, maxMs: 80, totalMs: 80 }
})

let lines: Array<Record<string, unknown>>
let session: PerfSession
beforeEach(() => {
  lines = []
  session = new PerfSession((line) => lines.push(line as Record<string, unknown>), 4)
})

describe('PerfSession.sample', () => {
  it('sem relatório do renderer usa contexto vazio e fps/loaf null', () => {
    session.sample([tab(1)], 'visible', 1000)
    expect(lines[0]).toMatchObject({
      kind: 'sample',
      t: 1,
      ctx: { window: 'visible', route: '', inCall: false, sharing: false, watching: false },
      procs: { Tab: { cpu: null, memMB: 2 } },
      fps: null,
      loaf: null
    })
  })

  it('usa o último relatório quando é recente e a janela está visível', () => {
    session.receive(report(), 1000)
    session.sample([tab(1)], 'visible', 2500)
    expect(lines[0]).toMatchObject({
      ctx: { window: 'visible', route: '/channels/:id', inCall: true },
      fps: 60,
      loaf: { count: 1, maxMs: 80, totalMs: 80 }
    })
  })

  it.each(['minimized', 'tray'] as const)(
    'janela %s: fps e loaf ficam null (o rAF é limitado a 1 Hz e viraria falso quadro longo)',
    (window) => {
      session.receive(report(), 1000)
      session.sample([tab(1)], window, 2500)
      expect(lines[0]).toMatchObject({
        ctx: { window, route: '/channels/:id', inCall: true },
        fps: null,
        loaf: null
      })
    }
  )

  it('relatório com mais de 2 s zera fps/loaf mas mantém a rota', () => {
    session.receive(report(), 1000)
    session.sample([tab(1)], 'minimized', 3001)
    expect(lines[0]).toMatchObject({
      ctx: { window: 'minimized', route: '/channels/:id' },
      fps: null,
      loaf: null
    })
  })
})

describe('PerfSession: abertura', () => {
  it('escreve a linha startup quando os três marcos chegam', () => {
    session.mark('appReady', 300)
    session.mark('readyToShow', 1200)
    expect(lines).toHaveLength(0)
    session.receive({ kind: 'mark', name: 'usable' }, 2000)
    expect(lines).toEqual([
      { kind: 'startup', appReadyMs: 300, readyToShowMs: 1200, usableMs: 2000 }
    ])
  })

  it('escreve a linha startup num sample depois de 1 minuto, mesmo sem usable', () => {
    session.mark('appReady', 300)
    session.sample([tab(1)], 'visible', 60_000)
    expect(lines.map((l) => l.kind)).toEqual(['sample', 'startup'])
    expect(lines[1]).toMatchObject({ usableMs: null })
  })
})
