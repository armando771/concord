import { beforeEach, describe, expect, it, vi } from 'vitest'

const disk = vi.hoisted(() => ({ content: null as string | null, failWrite: false }))
vi.mock('electron', () => ({ app: { getPath: () => '/data' } }))
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => {
    if (disk.content === null) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    return disk.content
  }),
  writeFileSync: vi.fn((_path: string, content: string) => {
    if (disk.failWrite) throw new Error('disk full')
    disk.content = content
  }),
  unlinkSync: vi.fn(() => {
    disk.content = null
  })
}))

import { saveCallResume, takeCallResume } from './callResume'

const snapshot = {
  userId: 'u',
  backendUrl: 'api',
  serverId: 's',
  channelId: 'c',
  muted: true,
  deafened: false,
  mutedBeforeDeafen: false
}

beforeEach(() => {
  disk.content = null
  disk.failWrite = false
})

describe('persistência da retomada', () => {
  it('grava antes de retornar e consome somente uma vez', () => {
    saveCallResume(snapshot)
    expect(disk.content).not.toBeNull()
    expect(takeCallResume()).toEqual({ ...snapshot, savedAt: expect.any(Number) })
    expect(disk.content).toBeNull()
    expect(takeCallResume()).toBeNull()
  })
  it('remove registros inválidos e limpa a retomada quando não há canal ativo', () => {
    disk.content = 'invalid json'
    expect(takeCallResume()).toBeNull()
    expect(disk.content).toBeNull()
    saveCallResume(snapshot)
    saveCallResume(null)
    expect(takeCallResume()).toBeNull()
  })
  it('propaga falha de disco para impedir instalação sem salvar', () => {
    disk.failWrite = true
    expect(() => saveCallResume(snapshot)).toThrow('disk full')
  })
})
