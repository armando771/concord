import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendEvent = vi.hoisted(() => vi.fn())
vi.mock('../../chat/store/chatStore', () => ({ useChatStore: { getState: () => ({ sendEvent }) } }))

import { useListeningStore } from './listeningStore'

const track = {
  app: 'Spotify',
  title: 'Águas de Março',
  artist: 'Elis Regina',
  album: 'Elis & Tom',
  durationMs: 225_000,
  startedAt: 1000
}
const listening = { app: 'Spotify', title: 'Águas de Março', started_at: 1000 }

beforeEach(() => {
  useListeningStore.setState({ byUser: {}, detected: null, enabled: true })
  useListeningStore.getState().setDetected(null)
  sendEvent.mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(61_000)
})

describe('listeningStore', () => {
  it('manda a música detectada com a posição de agora', () => {
    useListeningStore.getState().setDetected(track)
    expect(sendEvent).toHaveBeenCalledWith(
      'activity:set',
      expect.objectContaining({ kind: 'listening', title: 'Águas de Março', position_ms: 60_000 })
    )
  })

  it('só manda o limpar depois de ter mandado uma música', () => {
    useListeningStore.getState().publishMine()
    expect(sendEvent).not.toHaveBeenCalled()

    useListeningStore.getState().setDetected(track)
    useListeningStore.getState().setDetected(null)
    expect(sendEvent).toHaveBeenLastCalledWith('activity:clear', { kind: 'listening' })
  })

  it('desligar a opção limpa; religar manda de novo', () => {
    useListeningStore.getState().setDetected(track)
    useListeningStore.getState().setEnabled(false)
    expect(sendEvent).toHaveBeenLastCalledWith('activity:clear', { kind: 'listening' })
    useListeningStore.getState().setEnabled(true)
    expect(sendEvent).toHaveBeenLastCalledWith(
      'activity:set',
      expect.objectContaining({ app: 'Spotify' })
    )
  })

  it('guarda e tira a música de cada um', () => {
    useListeningStore.getState().setListening('u1', listening)
    expect(useListeningStore.getState().byUser.u1).toEqual(listening)
    useListeningStore.getState().setListening('u1', null)
    expect(useListeningStore.getState().byUser.u1).toBeUndefined()
  })

  it('carga inicial: quem veio sem música deixa de ter', () => {
    useListeningStore.setState({ byUser: { u1: listening, u3: listening } })
    useListeningStore.getState().applyFetched(['u1', 'u2'], {
      u2: { name: 'VALORANT', kind: 'game', started_at: 1, listening }
    })
    expect(useListeningStore.getState().byUser).toEqual({ u2: listening, u3: listening })
  })
})
