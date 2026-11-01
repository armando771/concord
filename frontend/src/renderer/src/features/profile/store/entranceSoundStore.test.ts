import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  uploadEntranceSound: vi.fn(),
  deleteEntranceSound: vi.fn()
}))
const meta = vi.hoisted(() => ({ readMediaMeta: vi.fn() }))
vi.mock('../api/entranceSound', () => api)
vi.mock('../../chat/lib/readMediaMeta', () => meta)

import { ApiError } from '../../../shared/api/client'
import { useAuthStore, type User } from '../../auth/store/authStore'
import { useEntranceSoundStore } from './entranceSoundStore'

const SOUND = '/api/entrance-sounds/0b6e7a52-3c1f-4c47-9d0e-2f6a8b1c4d5e'
const me: User = {
  id: 'eu',
  username: 'eu',
  display_name: 'Eu',
  email: 'e@x.com',
  status: 'idle',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
}
const mp3 = (size = 1000): File => {
  const f = new File(['x'], 'oi.mp3', { type: 'audio/mpeg' })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: me })
  useEntranceSoundStore.setState({ busy: null, error: null })
  meta.readMediaMeta.mockResolvedValue({ duration_ms: 2500 })
})

describe('entranceSoundStore.pick', () => {
  it('mede a duração, sobe e guarda a conta nova (mantendo o status da sessão)', async () => {
    api.uploadEntranceSound.mockResolvedValue({
      ...me,
      status: 'online',
      entrance_sound_url: SOUND
    })
    const file = mp3()
    await useEntranceSoundStore.getState().pick(file)

    expect(api.uploadEntranceSound).toHaveBeenCalledWith(file, 2500)
    expect(useAuthStore.getState().user?.entrance_sound_url).toBe(SOUND)
    expect(useAuthStore.getState().user?.status).toBe('idle')
    expect(useEntranceSoundStore.getState()).toMatchObject({ busy: null, error: null })
  })

  it('arquivo inválido ou duração fora de 0,1–5 s: avisa sem subir', async () => {
    await useEntranceSoundStore.getState().pick(mp3(3 * 1024 * 1024))
    expect(useEntranceSoundStore.getState().error).toBe('O som de entrada pode ter até 2 MB.')

    meta.readMediaMeta.mockResolvedValue({ duration_ms: 9000 })
    await useEntranceSoundStore.getState().pick(mp3())
    expect(useEntranceSoundStore.getState().error).toBe(
      'O som de entrada precisa ter entre 0,1 s e 5 s.'
    )

    meta.readMediaMeta.mockResolvedValue({})
    await useEntranceSoundStore.getState().pick(mp3())
    expect(api.uploadEntranceSound).not.toHaveBeenCalled()
  })

  it('erro do servidor vira mensagem em português', async () => {
    api.uploadEntranceSound.mockRejectedValue(new ApiError(415, 'only audio files'))
    await useEntranceSoundStore.getState().pick(mp3())
    expect(useEntranceSoundStore.getState()).toMatchObject({
      busy: null,
      error: 'Use um áudio MP3, WAV, OGG, M4A ou WebM.'
    })
  })

  it('não sobe dois ao mesmo tempo', async () => {
    useEntranceSoundStore.setState({ busy: 'upload' })
    await useEntranceSoundStore.getState().pick(mp3())
    expect(meta.readMediaMeta).not.toHaveBeenCalled()
  })
})

describe('entranceSoundStore.remove', () => {
  it('volta ao som padrão', async () => {
    useAuthStore.setState({ user: { ...me, entrance_sound_url: SOUND } })
    api.deleteEntranceSound.mockResolvedValue({ ...me, entrance_sound_url: null })
    await useEntranceSoundStore.getState().remove()
    expect(useAuthStore.getState().user?.entrance_sound_url).toBeNull()
  })

  it('falha de rede: avisa e mantém o som', async () => {
    useAuthStore.setState({ user: { ...me, entrance_sound_url: SOUND } })
    api.deleteEntranceSound.mockRejectedValue(new Error('Sem conexão com o servidor'))
    await useEntranceSoundStore.getState().remove()
    expect(useEntranceSoundStore.getState().error).toBe('Sem conexão com o servidor')
    expect(useAuthStore.getState().user?.entrance_sound_url).toBe(SOUND)
  })
})
