import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ listener: null as null | (() => void), play: vi.fn() }))
vi.mock('../../../shared/api/ws', () => ({
  onWsEvent: (l: () => void) => {
    h.listener = l
    return () => {
      h.listener = null
    }
  }
}))
vi.mock('./sounds', () => ({ playSound: h.play }))
// O callStore de verdade puxa LiveKit e áudio: aqui um store zustand com os mesmos campos.
vi.mock('../store/callStore', async () => {
  const { create } = await import('zustand')
  return { useCallStore: create(() => ({})) }
})
vi.mock('../../auth/store/authStore', async () => {
  const { create } = await import('zustand')
  return { useAuthStore: create(() => ({ user: { id: 'eu' } })) }
})

import { useCallStore } from '../store/callStore'
import { startScreenSounds } from './screenSoundsStart'

describe('startScreenSounds (store zustand + ouvinte do WS)', () => {
  let stop: () => void

  beforeEach(() => {
    h.play.mockClear()
    useCallStore.setState({
      callId: 'c1',
      status: 'active',
      deafened: false,
      participants: [{ id: 'ana' }] as never,
      screenSharers: [],
      screenWatchers: {}
    })
    stop = startScreenSounds()
  })

  afterEach(() => stop())

  it('live aberta por evento do WS toca; a mesma mudança fora do WS (carga) não', async () => {
    useCallStore.setState({ screenSharers: ['ana'] })
    await Promise.resolve() // o turno acabou sem evento do WS: era carga
    h.listener?.()
    expect(h.play).not.toHaveBeenCalled()

    useCallStore.setState({ screenSharers: [] })
    await Promise.resolve()
    useCallStore.setState({ screenSharers: ['ana'] })
    h.listener?.() // o ouvinte do WS roda logo depois do store, no mesmo turno
    expect(h.play).toHaveBeenCalledWith('liveStart')
  })

  it('desligar remove os ouvintes', () => {
    stop()
    expect(h.listener).toBeNull()
    stop = startScreenSounds()
  })
})
