import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

type Fn = (...args: any[]) => any // eslint-disable-line @typescript-eslint/no-explicit-any
const electron = vi.hoisted(() => ({
  handlers: new Map<string, Fn>(),
  listeners: new Map<string, Fn>(),
  appListeners: new Map<string, Fn>(),
  userData: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => electron.userData,
    getAppMetrics: () => [],
    on: (name: string, cb: Fn) => electron.appListeners.set(name, cb),
    once: (name: string, cb: Fn) => electron.appListeners.set(name, cb)
  },
  ipcMain: {
    handle: (name: string, cb: Fn) => electron.handlers.set(name, cb),
    on: (name: string, cb: Fn) => electron.listeners.set(name, cb)
  }
}))
vi.mock('../app/appLog', () => ({ appendLog: vi.fn() }))

import { setupPerfLog } from './setupPerfLog'

const webContents = { mainFrame: {} }
const win = {
  isDestroyed: () => false,
  isMinimized: () => false,
  isVisible: () => true,
  webContents
} as unknown as BrowserWindow

const report = {
  kind: 'report',
  ctx: { route: '/channels/42', inCall: false, sharing: false, watching: false },
  fps: 60,
  loaf: { count: 0, maxMs: 0, totalMs: 0 }
}
const fromWindow = { sender: webContents, senderFrame: webContents.mainFrame }

function readLog(): Array<Record<string, unknown>> {
  const dir = join(electron.userData, 'perf')
  const [file] = readdirSync(dir)
  return readFileSync(join(dir, file), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
}

beforeEach(() => {
  electron.handlers.clear()
  electron.listeners.clear()
  electron.appListeners.clear()
  electron.userData = mkdtempSync(join(tmpdir(), 'perf-setup-'))
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  rmSync(electron.userData, { recursive: true, force: true })
})

describe('setupPerfLog', () => {
  it('sem a flag: responde false e não cria timer, listener nem arquivo', async () => {
    vi.stubEnv('SALINHA_PERF_LOG', '')
    setupPerfLog(() => win)
    expect(await electron.handlers.get('perf:enabled')!()).toBe(false)
    expect(electron.listeners.size).toBe(0)
    expect(electron.appListeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(readdirSync(electron.userData)).toEqual([])
  })

  it('com a flag: grava amostras com o contexto do renderer e fecha com end', async () => {
    vi.stubEnv('SALINHA_PERF_LOG', '1')
    setupPerfLog(() => win)
    expect(await electron.handlers.get('perf:enabled')!()).toBe(true)

    electron.listeners.get('perf:report')!(fromWindow, report)
    vi.advanceTimersByTime(1000)
    electron.appListeners.get('before-quit')!()

    const lines = readLog()
    expect(lines[0]).toMatchObject({
      kind: 'sample',
      ctx: { window: 'visible', route: '/channels/:id' },
      fps: 60
    })
    expect(lines.at(-1)).toMatchObject({ kind: 'end' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignora relatório de outro sender e de outro frame', () => {
    vi.stubEnv('SALINHA_PERF_LOG', '1')
    setupPerfLog(() => win)
    electron.listeners.get('perf:report')!({ sender: {}, senderFrame: webContents.mainFrame }, report)
    electron.listeners.get('perf:report')!({ sender: webContents, senderFrame: {} }, report)
    vi.advanceTimersByTime(1000)
    electron.appListeners.get('before-quit')!()
    expect(readLog()[0]).toMatchObject({ ctx: { route: '' }, fps: null })
  })

  it('ignora relatório com formato inválido', () => {
    vi.stubEnv('SALINHA_PERF_LOG', '1')
    setupPerfLog(() => win)
    electron.listeners.get('perf:report')!(fromWindow, { kind: 'report', ctx: 7 })
    vi.advanceTimersByTime(1000)
    electron.appListeners.get('before-quit')!()
    expect(readLog()[0]).toMatchObject({ fps: null })
  })
})
