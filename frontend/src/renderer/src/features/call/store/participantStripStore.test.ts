import { beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'concord:participant-strip-hidden'

function fakeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v)
  } as Storage
}

async function load(): Promise<typeof import('./participantStripStore')> {
  vi.resetModules()
  return import('./participantStripStore')
}

describe('participantStripStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('começa visível e alterna', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const { useParticipantStripStore } = await load()
    expect(useParticipantStripStore.getState().hidden).toBe(false)
    useParticipantStripStore.getState().toggle()
    expect(useParticipantStripStore.getState().hidden).toBe(true)
    useParticipantStripStore.getState().toggle()
    expect(useParticipantStripStore.getState().hidden).toBe(false)
  })

  it('lembra a escolha neste computador', async () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    const first = await load()
    first.useParticipantStripStore.getState().toggle()
    expect(storage.getItem(KEY)).toBe('1')

    const second = await load()
    expect(second.useParticipantStripStore.getState().hidden).toBe(true)
  })

  it('sem armazenamento usa o padrão e não quebra ao alternar', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      }
    }
    vi.stubGlobal('localStorage', blocked)
    const { useParticipantStripStore } = await load()
    expect(useParticipantStripStore.getState().hidden).toBe(false)
    useParticipantStripStore.getState().toggle()
    expect(useParticipantStripStore.getState().hidden).toBe(true)
  })
})
