import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  state: {
    packaged: true,
    clsid: null as string | null,
    links: {} as Record<string, Record<string, unknown>>,
    writes: [] as Array<[string, string, Record<string, unknown>]>,
    deleted: [] as string[]
  }
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return h.state.packaged
    },
    getPath: (name: string) => (name === 'appData' ? '/appdata' : '/logs'),
    setToastActivatorCLSID: (id: string) => {
      h.state.clsid = id
    }
  },
  shell: {
    readShortcutLink: (path: string) => h.state.links[path],
    writeShortcutLink: (path: string, op: string, options: Record<string, unknown>) => {
      h.state.writes.push([path, op, options])
      return true
    }
  }
}))
vi.mock('fs', () => ({
  existsSync: (path: string) => path in h.state.links,
  unlinkSync: (path: string) => {
    h.state.deleted.push(path)
    delete h.state.links[path]
  }
}))
vi.mock('../app/appLog', () => ({ appendLog: vi.fn() }))

const programs = join('/appdata', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
const realPlatform = process.platform
const realExecPath = process.execPath

async function setup(): Promise<void> {
  const { setupToasts } = await import('./toasts')
  setupToasts()
}

beforeEach(() => {
  vi.resetModules()
  Object.defineProperty(process, 'platform', { value: 'win32' })
  Object.defineProperty(process, 'execPath', { value: '/apps/concord/Salinha.exe' })
  delete process.env.PORTABLE_EXECUTABLE_FILE
  h.state.packaged = true
  h.state.clsid = null
  h.state.links = {}
  h.state.writes = []
  h.state.deleted = []
})

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform })
  Object.defineProperty(process, 'execPath', { value: realExecPath })
  delete process.env.PORTABLE_EXECUTABLE_FILE
})

describe('setupToasts', () => {
  it('fixa o CLSID e cria o Salinha.lnk com AUMID e o mesmo CLSID', async () => {
    await setup()
    expect(h.state.clsid).toMatch(/^\{[0-9A-F-]{36}\}$/)
    expect(h.state.writes).toHaveLength(1)
    const [path, op, options] = h.state.writes[0]
    expect(path).toBe(join(programs, 'Salinha.lnk'))
    expect(op).toBe('create')
    expect(options).toMatchObject({
      target: '/apps/concord/Salinha.exe',
      appUserModelId: 'com.concord.app',
      toastActivatorClsid: h.state.clsid
    })
  })

  it('atalho já correto não é regravado', async () => {
    const { TOAST_ACTIVATOR_CLSID } = await import('./toastPolicy')
    h.state.links[join(programs, 'Salinha.lnk')] = {
      target: '/apps/concord/Salinha.exe',
      appUserModelId: 'com.concord.app',
      toastActivatorClsid: TOAST_ACTIVATOR_CLSID
    }
    await setup()
    expect(h.state.writes).toEqual([])
  })

  it('Concord.lnk antigo com o nosso AUMID é apagado: só sobra o Salinha', async () => {
    h.state.links[join(programs, 'Concord.lnk')] = {
      target: '/apps/concord/Concord.exe',
      appUserModelId: 'com.concord.app'
    }
    await setup()
    expect(h.state.deleted).toEqual([join(programs, 'Concord.lnk')])
    expect(h.state.writes.map(([p, op]) => [p, op])).toEqual([
      [join(programs, 'Salinha.lnk'), 'create']
    ])
  })

  it('Concord.lnk de outro programa fica onde está', async () => {
    h.state.links[join(programs, 'Concord.lnk')] = { target: '/outro/Concord.exe', appUserModelId: 'x' }
    await setup()
    expect(h.state.deleted).toEqual([])
  })

  it('portable e dev não mexem em nada', async () => {
    process.env.PORTABLE_EXECUTABLE_FILE = 'C:\\Temp\\Salinha.exe'
    await setup()
    h.state.packaged = false
    delete process.env.PORTABLE_EXECUTABLE_FILE
    await setup()
    expect(h.state.clsid).toBeNull()
    expect(h.state.writes).toEqual([])
    expect(h.state.deleted).toEqual([])
  })
})
