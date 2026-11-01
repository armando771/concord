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
const currentServer = vi.hoisted(() => ({ value: null as { id: string } | null }))
vi.mock('../../servers/store/serverStore', () => ({
  useServerStore: {
    getState: () => ({
      servers: [{ id: 's1', name: 'Salinha' }],
      currentServer: currentServer.value
    }),
    subscribe: () => () => {}
  }
}))
vi.mock('../../call/lib/sounds', () => ({ playSound: () => {} }))
vi.mock('../../call/store/callStore', () => ({
  useCallStore: { getState: () => ({ deafened: false }) }
}))

import { previewServerLevelUp, startServerLevels } from './serverLevelStart'
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

  it('quem está no servidor ganha a animação no lugar do toast', async () => {
    const { useServerLevelUpStore } = await import('../store/serverLevelUpStore')
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: () => {},
      removeEventListener: () => {}
    })
    currentServer.value = { id: 's1' }
    emit('server:level:up', { server_id: 's1', level: 4, previous_level: 3 })
    expect(success).not.toHaveBeenCalled()
    expect(useServerLevelUpStore.getState().current?.level).toBe(4)
    currentServer.value = null
    vi.unstubAllGlobals()
  })

  it('subida de nível fora do servidor vira um toast com o nome do servidor', () => {
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

  it('prévia de dev toca a animação no servidor aberto', async () => {
    const { useServerLevelUpStore } = await import('../store/serverLevelUpStore')
    previewServerLevelUp(25)
    expect(useServerLevelUpStore.getState().current).toMatchObject({
      serverId: 's1',
      level: 25,
      previous: 24
    })
  })
})
