import { beforeEach, describe, expect, it, vi } from 'vitest'

const listeners: Array<(e: { type: string; payload: unknown }) => void> = []
vi.mock('../../../shared/api/ws', () => ({
  onWsEvent: (l: (e: { type: string; payload: unknown }) => void) => {
    listeners.push(l)
    return () => {}
  }
}))
const success = vi.fn()
vi.mock('../../../shared/store/toastStore', () => ({
  showToast: { success: (m: string) => success(m) }
}))
const load = vi.fn()
vi.mock('../api/serverLevel', () => ({ fetchServerLevel: (id: string) => load(id) }))
vi.mock('../../servers/store/serverStore', () => ({
  useServerStore: { getState: () => ({ servers: [{ id: 's1', name: 'Salinha' }] }) }
}))

import { startServerLevels } from './serverLevelStart'
import { useServerLevelStore } from '../store/serverLevelStore'

const emit = (type: string, payload: unknown): void =>
  listeners.forEach((l) => l({ type, payload }))

describe('startServerLevels', () => {
  beforeEach(() => {
    listeners.length = 0
    success.mockReset()
    load.mockReset()
    useServerLevelStore.getState().reset()
    startServerLevels()
  })

  it('subida de nível vira um toast com o nome do servidor', () => {
    emit('server:level:up', { server_id: 's1', level: 4, previous_level: 3 })
    expect(success).toHaveBeenCalledWith('Salinha subiu para o nível 4!')
    expect(load).not.toHaveBeenCalled()
  })

  it('com o detalhamento já carregado, a subida recarrega a semana', () => {
    load.mockResolvedValue({
      server_id: 's1',
      level: 4,
      xp: 1,
      xp_into_level: 1,
      xp_for_next: 1,
      week: []
    })
    useServerLevelStore.setState({ week: { s1: [] } })
    emit('server:level:up', { server_id: 's1', level: 4 })
    expect(load).toHaveBeenCalledWith('s1')
  })

  it('update anda a barra do servidor', () => {
    const p = { server_id: 's1', level: 2, xp: 300, xp_into_level: 50, xp_for_next: 1000 }
    emit('server:level:update', p)
    expect(useServerLevelStore.getState().byServer.s1).toEqual(p)
  })
})
