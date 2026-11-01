import { beforeEach, describe, expect, it, vi } from 'vitest'

const SOUND = '/api/entrance-sounds/0b6e7a52-3c1f-4c47-9d0e-2f6a8b1c4d5e'

const mocks = vi.hoisted(() => ({
  user: { id: 'eu', entrance_sound_url: null as string | null },
  playClip: vi.fn(async () => true),
  playSound: vi.fn()
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: { getState: () => ({ user: mocks.user }) }
}))
vi.mock('../../../shared/lib/config', () => ({ API_BASE_URL: '/api' }))
vi.mock('../store/soundboardStore', () => ({
  useSoundboardStore: { getState: () => ({ volume: 0.5 }) }
}))
vi.mock('./entranceSoundPlayer', () => ({ playEntranceClip: mocks.playClip }))
vi.mock('./sounds', () => ({ playSound: mocks.playSound }))

import { playOwnJoinSound } from './entranceSoundOwn'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = { id: 'eu', entrance_sound_url: SOUND }
  mocks.playClip.mockResolvedValue(true)
})

describe('playOwnJoinSound', () => {
  it('toca o meu som de entrada, sem o "join" padrão', async () => {
    await playOwnJoinSound(false)
    expect(mocks.playClip).toHaveBeenCalledWith(SOUND, 0.5)
    expect(mocks.playSound).not.toHaveBeenCalled()
  })

  it('sem som de entrada no perfil: o "join" padrão', async () => {
    mocks.user = { id: 'eu', entrance_sound_url: null }
    await playOwnJoinSound(false)
    expect(mocks.playClip).not.toHaveBeenCalled()
    expect(mocks.playSound).toHaveBeenCalledTimes(1)
    expect(mocks.playSound).toHaveBeenCalledWith('join')
  })

  it('ensurdecido: só o "join" padrão', async () => {
    await playOwnJoinSound(true)
    expect(mocks.playClip).not.toHaveBeenCalled()
    expect(mocks.playSound).toHaveBeenCalledTimes(1)
    expect(mocks.playSound).toHaveBeenCalledWith('join')
  })

  it('o arquivo não tocou: cai no "join" padrão, uma vez só', async () => {
    mocks.playClip.mockResolvedValue(false)
    await playOwnJoinSound(false)
    expect(mocks.playSound).toHaveBeenCalledTimes(1)
    expect(mocks.playSound).toHaveBeenCalledWith('join')
  })
})
